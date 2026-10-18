import { aiAvailable, generateStructured } from "../ai.ts";
import type { Store } from "../db.ts";
import { type BrandSignals, type Business, type DesignBrief, SiteContent } from "../types.ts";
import { INDUSTRY_PROFILES } from "./industries.ts";

// Website copy. The hard rule for demos: never state facts we don't have.
// No invented prices, years in business, awards, reviews or dishes.

const SYSTEM = `You are a website copywriter for local businesses. You write concise, specific, human copy in the business's tone of voice.
Hard rules:
- Use only facts present in the input. Never invent prices, dates, years in business, awards, ratings, reviews, testimonials, staff names, dishes or certifications.
- If a detail is unknown, write copy that is true without it (e.g. "Ask about today's specials") rather than guessing.
- services[].price must be null unless an exact price appears in the input.
- Write in the language used on the business's current website; if there is none, use the main language of its city/country.
- Headlines under 9 words. No clichés like "Welcome to our website".`;

export function fallbackContent(b: Business, brief: DesignBrief): SiteContent {
  const profile = INDUSTRY_PROFILES[b.industry];
  const where = b.city ? ` in ${b.city}` : "";
  return {
    heroHeadline: b.name,
    heroSubheadline: `${profile.label}${where}. ${brief.toneOfVoice.startsWith("refined") ? "Thoughtfully done." : "We'd love to see you."}`,
    primaryCta: profile.ctaFallback,
    about: `${b.name} is a ${profile.label.toLowerCase()}${where}. This section will tell your story in your own words — who you are, what you care about, and what makes a visit special.`,
    highlights: profile.fallback.highlights,
    services: profile.fallback.services.map((s) => ({ ...s, price: null })),
    faq: profile.fallback.faq,
    seoTitle: `${b.name} — ${profile.label}${where}`,
    seoDescription: `${b.name}, ${profile.label.toLowerCase()}${where}.${b.openingHours ? " Opening hours, location and contact details." : " Location and contact details."}`,
  };
}

export async function writeContent(opts: {
  store: Store;
  business: Business;
  brief: DesignBrief;
  signals: BrandSignals | null;
}): Promise<{ content: SiteContent; source: "ai" | "heuristic" }> {
  const { business: b, brief, signals } = opts;
  if (!aiAvailable()) return { content: fallbackContent(b, brief), source: "heuristic" };

  const profile = INDUSTRY_PROFILES[b.industry];
  const prompt = `Write the website copy for this business.

<business>
${JSON.stringify({ name: b.name, industry: profile.label, city: b.city, country: b.country, address: b.address, openingHours: b.openingHours }, null, 2)}
</business>

<design_brief>
${JSON.stringify({ positioning: brief.positioning, audience: brief.audience, toneOfVoice: brief.toneOfVoice }, null, 2)}
</design_brief>

<text_from_current_website>
${signals?.textSample ?? "(no website)"}
</text_from_current_website>

The "${profile.offerLabel}" section lists services[] (3-8 items, grouped sensibly; use real items from the current website if present). highlights: exactly 3. faq: 2-4 questions customers of a ${profile.label.toLowerCase()} actually ask. primaryCta should suit: ${profile.ctaFallback}.`;

  try {
    const content = await generateStructured({ store: opts.store, businessId: b.id, purpose: "content", schema: SiteContent, system: SYSTEM, prompt });
    return { content, source: "ai" };
  } catch (err) {
    opts.store.log(b.id, "ai_error", `content: ${(err as Error).message}`);
    return { content: fallbackContent(b, brief), source: "heuristic" };
  }
}
