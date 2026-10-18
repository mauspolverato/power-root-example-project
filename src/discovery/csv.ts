import { readFileSync } from "node:fs";
import { BusinessInput, Industry } from "../types.ts";

// Import leads you collected yourself (a chamber-of-commerce list, a trade
// directory export, businesses you walked past). Header row required; columns:
// name,industry,address,city,country,phone,email,website,instagram,facebook,opening_hours
// Optional: whatsapp, language (es|en), photos (file paths or URLs separated by "|").

/** Minimal RFC 4180 parser: handles quoted fields, escaped quotes, and commas/newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export function importCsv(file: string): BusinessInput[] {
  const [header, ...rows] = parseCsv(readFileSync(file, "utf8"));
  if (!header) return [];
  const cols = header.map((h) => h.trim().toLowerCase());
  return rows.map((r, i) => {
    const get = (k: string) => {
      const idx = cols.indexOf(k);
      const v = idx >= 0 ? r[idx]?.trim() : undefined;
      return v || undefined;
    };
    const industry = Industry.safeParse(get("industry"));
    const socials: Record<string, string> = {};
    for (const s of ["instagram", "facebook", "tiktok"]) {
      const v = get(s);
      if (v) socials[s] = v;
    }
    return BusinessInput.parse({
      name: get("name"),
      industry: industry.success ? industry.data : "other",
      address: get("address"),
      city: get("city"),
      country: get("country"),
      phone: get("phone"),
      email: get("email"),
      website: get("website"),
      openingHours: get("opening_hours"),
      whatsapp: get("whatsapp"),
      language: get("language"),
      photos: (get("photos") ?? "").split("|").map((p) => p.trim()).filter(Boolean),
      socials,
      source: "csv",
      sourceId: `${get("name")}|${get("address") ?? i}`.toLowerCase(),
    });
  });
}
