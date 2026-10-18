import { config } from "../config.ts";
import type { BusinessInput, Industry } from "../types.ts";

// Google Places API (New) Text Search. Paid per request (see Google's pricing
// page; Text Search with contact fields is in the "Enterprise" SKU). Google's
// terms only allow caching place IDs long-term; other fields should be
// refreshed rather than stored indefinitely — we store them for the lead's
// working life and re-fetch before outreach.

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.rating",
  "places.userRatingCount",
].join(",");

const QUERY_WORDS: Record<Industry, string> = {
  restaurant: "restaurants",
  cafe: "cafés",
  bar: "bars",
  hotel: "hotels",
  barber: "barber shops",
  salon: "hair salons",
  gym: "gyms",
  clothing: "clothing stores",
  dental: "dental clinics",
  real_estate: "real estate agencies",
  manufacturer: "manufacturers and workshops",
  other: "local businesses",
};

interface Place {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}

export async function discoverGooglePlaces(city: string, industry: Industry, limit = 20, languageCode = "es"): Promise<BusinessInput[]> {
  if (!config.googlePlacesKey) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": config.googlePlacesKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: `${QUERY_WORDS[industry]} in ${city}`, pageSize: Math.min(limit, 20), languageCode }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Google Places returned HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { places?: Place[] };
  return (json.places ?? []).map((p) => ({
    name: p.displayName?.text ?? "Unknown",
    industry,
    address: p.formattedAddress,
    city,
    phone: p.nationalPhoneNumber,
    website: p.websiteUri,
    openingHours: p.regularOpeningHours?.weekdayDescriptions?.join("; "),
    lat: p.location?.latitude,
    lon: p.location?.longitude,
    socials: {},
    photos: [],
    source: "google_places",
    sourceId: p.id,
  }));
}
