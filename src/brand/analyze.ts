import { aiAvailable, generateStructured } from "../ai.ts";
import type { Store } from "../db.ts";
import { ensureContrast, isHex, luminance, mix } from "../generator/color.ts";
import { INDUSTRY_PROFILES, SECTION_IDS, pick, stableHash, type SectionId } from "../generator/industries.ts";
import { type BrandSignals, type Business, DesignBrief, type WebsiteAudit } from "../types.ts";

// Turns raw signals into a design brief. With Claude available, the brief is
// reasoned from the business's own text, colors and fonts; without it, a
// deterministic fallback still respects the existing brand colors.

const SYSTEM = `You are the senior brand designer at a small web studio. You write design briefs for website redesigns of local businesses.
Rules:
- Preserve the business's existing identity (logo colors, fonts, tone) when it is coherent; refine rather than replace it. Only propose a new direction when the current one is missing or clearly broken, and say so.
- Base every claim on the evidence provided. Do not invent awards, history, specialities, prices or reviews.
- Colors must be hex values with readable contrast (body text on background at least 4.5:1).
- Fonts must be Google Fonts families.
- sectionOrder may only use the section ids you are given, and must start with "hero" and end with "contact".`;

export function heuristicBrief(b: Business, signals: BrandSignals | null): DesignBrief {
  const profile = INDUSTRY_PROFILES[b.industry];
  const seed = stableHash(b.name);
  const base = pick(profile.palettes, seed);
  const brandColors = signals?.colors ?? [];
  const keep = brandColors.length > 0;

  const palette = keep
    ? {
        ...base,
        primary: brandColors[0]!,
        accent: brandColors[1] ?? base.accent,
        secondary: mix(brandColors[0]!, "#ffffff", 0.88),
      }
    : base;

  const fonts = pick(profile.fontPairs, seed, 1);
  const style = pick(profile.styles, seed, 2);
  const heroes = ["split", "centered", "fullbleed"] as const;

  return {
    positioning: `${b.name} is a ${profile.label.toLowerCase()}${b.city ? ` in ${b.city}` : ""}.`,
    audience: `Local residents and visitors${b.city ? ` in ${b.city}` : ""} looking for a ${profile.label.toLowerCase()}.`,
    toneOfVoice: style === "bold" ? "confident and direct" : style === "luxury" ? "refined and understated" : "warm and welcoming",
    preserveExistingIdentity: keep,
    palette,
    typography: signals?.fonts[0] ? { heading: signals.fonts[0], body: fonts.body } : fonts,
    style,
    layout: { hero: pick(heroes, seed, 3), sectionOrder: profile.sections },
    imageryDirection: "Natural light photography of the real space, people and products. No generic stock.",
    reasons: keep
      ? [`Keeps the existing brand colour ${brandColors[0]} found on the current website.`]
      : ["No consistent brand colours were found, so the palette follows proven choices for this industry."],
  };
}

/** Clamp an AI- or heuristic-produced brief to things we can render safely. */
export function sanitizeBrief(brief: DesignBrief, industry: Business["industry"]): DesignBrief {
  const profile = INDUSTRY_PROFILES[industry];
  const fallback = pick(profile.palettes, 0);
  const p = { ...brief.palette };
  for (const k of Object.keys(p) as (keyof typeof p)[]) if (!isHex(p[k])) p[k] = fallback[k];

  // Light backgrounds only: dark themes need a different component set we don't render yet.
  if (luminance(p.background) < 0.6) p.background = fallback.background;
  p.text = ensureContrast(p.text, p.background, 7);
  p.primary = ensureContrast(p.primary, p.background, 4.5);

  const allowed = new Set<string>(profile.sections);
  const order = brief.layout.sectionOrder.filter((s, i, arr) => allowed.has(s) && arr.indexOf(s) === i && s !== "hero" && s !== "contact");
  const sectionOrder = ["hero", ...order, "contact"] as SectionId[];
  if (sectionOrder.length < 4) sectionOrder.splice(1, 0, ...profile.sections.filter((s) => !sectionOrder.includes(s)));

  return { ...brief, palette: p, layout: { ...brief.layout, sectionOrder } };
}

export async function buildBrief(opts: {
  store: Store;
  business: Business;
  audit: WebsiteAudit;
  signals: BrandSignals | null;
}): Promise<{ brief: DesignBrief; source: "ai" | "heuristic" }> {
  const { business: b, audit, signals } = opts;
  if (!aiAvailable()) return { brief: sanitizeBrief(heuristicBrief(b, signals), b.industry), source: "heuristic" };

  const profile = INDUSTRY_PROFILES[b.industry];
  const prompt = `Write a design brief for a new website for this business.

<business>
${JSON.stringify({ name: b.name, industry: profile.label, city: b.city, address: b.address, openingHours: b.openingHours, socials: { ...b.socials, ...audit.socialLinks } }, null, 2)}
</business>

<current_website_audit>
${JSON.stringify({ url: audit.url, reachable: audit.reachable, issues: audit.issues.map((i) => i.message), features: audit.features, title: audit.title, metaDescription: audit.metaDescription }, null, 2)}
</current_website_audit>

<brand_signals_extracted_from_current_site>
${signals ? JSON.stringify({ colors: signals.colors, fonts: signals.fonts, hasLogo: Boolean(signals.logoUrl), tagline: signals.tagline }, null, 2) : "No website available — no existing brand signals."}
</brand_signals_extracted_from_current_site>

<website_text_sample>
${signals?.textSample ?? "(none)"}
</website_text_sample>

Available section ids for this industry: ${profile.sections.join(", ")} (all ids we support: ${SECTION_IDS.join(", ")}).
Choose the style, hero layout and section order that best fit this particular business.`;

  try {
    const brief = await generateStructured({ store: opts.store, businessId: b.id, purpose: "brief", schema: DesignBrief, system: SYSTEM, prompt });
    return { brief: sanitizeBrief(brief, b.industry), source: "ai" };
  } catch (err) {
    opts.store.log(b.id, "ai_error", `brief: ${(err as Error).message}`);
    return { brief: sanitizeBrief(heuristicBrief(b, signals), b.industry), source: "heuristic" };
  }
}
