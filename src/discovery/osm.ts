import { config } from "../config.ts";
import type { BusinessInput, Industry } from "../types.ts";

// OpenStreetMap via the Overpass API: free, no key, and the data is openly
// licensed (ODbL — attribution required if you republish it). Coverage of
// websites/phones varies by city, which is exactly the signal we want: many
// small businesses have no website tag at all.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** OSM tags that identify each industry we target. */
export const OSM_TAGS: Record<Exclude<Industry, "other">, string[]> = {
  restaurant: ['"amenity"="restaurant"'],
  cafe: ['"amenity"="cafe"'],
  bar: ['"amenity"~"^(bar|pub)$"'],
  hotel: ['"tourism"~"^(hotel|guest_house)$"'],
  barber: ['"shop"="hairdresser"["hairdresser"="barber"]', '"shop"="barber"'],
  salon: ['"shop"~"^(hairdresser|beauty)$"'],
  gym: ['"leisure"="fitness_centre"'],
  clothing: ['"shop"~"^(clothes|boutique)$"'],
  dental: ['"amenity"="dentist"', '"healthcare"="dentist"'],
  real_estate: ['"office"="estate_agent"', '"shop"="estate_agent"'],
};

export function buildOverpassQuery(city: string, industry: Exclude<Industry, "other">, limit: number): string {
  const selectors = OSM_TAGS[industry]
    .map((tag) => `nwr[${tag}]["name"](area.city);`)
    .join("\n  ");
  return `[out:json][timeout:60];
area["name"="${city.replace(/"/g, "")}"]["boundary"="administrative"]->.city;
(
  ${selectors}
);
out center tags ${limit};`;
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOsmElements(elements: OsmElement[], industry: Industry, city: string): BusinessInput[] {
  return elements
    .filter((e) => e.tags?.name)
    .map((e) => {
      const t = e.tags!;
      const socials: Record<string, string> = {};
      for (const key of ["facebook", "instagram", "tiktok", "twitter"]) {
        const v = t[`contact:${key}`] ?? t[key];
        if (v) socials[key] = v;
      }
      const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
      return {
        name: t.name!,
        industry,
        address: [street, t["addr:postcode"], t["addr:city"] ?? city].filter(Boolean).join(", ") || undefined,
        city: t["addr:city"] ?? city,
        country: t["addr:country"],
        phone: t.phone ?? t["contact:phone"],
        email: t.email ?? t["contact:email"],
        website: t.website ?? t["contact:website"] ?? t.url,
        openingHours: t.opening_hours,
        lat: e.lat ?? e.center?.lat,
        lon: e.lon ?? e.center?.lon,
        socials,
        whatsapp: t["contact:whatsapp"],
        photos: [],
        source: "osm",
        sourceId: `${e.type}/${e.id}`,
      } satisfies BusinessInput;
    });
}

export async function discoverOsm(city: string, industry: Exclude<Industry, "other">, limit = 50): Promise<BusinessInput[]> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": config.userAgent },
    body: new URLSearchParams({ data: buildOverpassQuery(city, industry, limit) }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Overpass API returned HTTP ${res.status}`);
  const json = (await res.json()) as { elements: OsmElement[] };
  return parseOsmElements(json.elements, industry, city);
}
