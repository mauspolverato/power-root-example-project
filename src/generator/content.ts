import { aiAvailable, generateStructured } from "../ai.ts";
import type { Store } from "../db.ts";
import { type BrandSignals, type Business, type DesignBrief, SiteContent } from "../types.ts";
import { INDUSTRY_TEXT, localeFor, UI } from "./i18n.ts";

// Website copy. The hard rule: never state facts we don't have.
// No invented prices, years in business, awards, reviews or dishes.

const SYSTEM = `You are a website copywriter for local businesses. You write concise, specific, human copy in the business's tone of voice.
Hard rules:
- Use only facts present in the input. Never invent prices, dates, years in business, awards, ratings, reviews, testimonials, staff names, dishes or certifications.
- If a detail is unknown, write copy that is true without it (e.g. "Ask about today's specials") rather than guessing.
- services[].price must be null unless an exact price appears in the input.
- Write in the language you are told to use. For Spanish aimed at Venezuela, write natural Venezuelan Spanish (tuteo, warm and close), without forced slang.
- Headlines under 9 words. No clichés like "Welcome to our website".`;

export function fallbackContent(b: Business): SiteContent {
  const locale = localeFor(b);
  const t = INDUSTRY_TEXT[locale][b.industry];
  const ui = UI[locale];
  const where = b.city ? `${ui.in}${b.city}` : "";
  return {
    heroHeadline: b.name,
    heroSubheadline: ui.heroFallback(t.label, where),
    primaryCta: t.ctaFallback,
    about: ui.aboutFallback(b.name, `${t.article} ${t.label.toLowerCase()}`, where),
    highlights: t.highlights,
    services: t.services.map((s) => ({ ...s, price: null })),
    faq: t.faq,
    seoTitle: `${b.name} — ${t.label}${where}`,
    seoDescription: `${b.name}, ${t.label.toLowerCase()}${where}.${b.address ? ` ${b.address}.` : ""}`.slice(0, 158),
  };
}

export async function writeContent(opts: {
  store: Store;
  business: Business;
  brief: DesignBrief;
  signals: BrandSignals | null;
}): Promise<{ content: SiteContent; source: "ai" | "heuristic" }> {
  const { business: b, brief, signals } = opts;
  if (!aiAvailable()) return { content: fallbackContent(b), source: "heuristic" };

  const locale = localeFor(b);
  const t = INDUSTRY_TEXT[locale][b.industry];
  const prompt = `Write the website copy for this business. Language: ${locale === "es" ? "Spanish" : "English"}${b.country ? ` (audience in ${b.country})` : ""}.

<business>
${JSON.stringify({ name: b.name, industry: t.label, city: b.city, country: b.country, address: b.address, openingHours: b.openingHours, socials: b.socials }, null, 2)}
</business>

<design_brief>
${JSON.stringify({ positioning: brief.positioning, audience: brief.audience, toneOfVoice: brief.toneOfVoice }, null, 2)}
</design_brief>

<text_from_current_website>
${signals?.textSample ?? "(no website)"}
</text_from_current_website>

The "${t.offerLabel}" section lists services[] (3-8 items, grouped sensibly; use real items from the current website if present). highlights: exactly 3. faq: 2-4 questions customers of this kind of business actually ask. primaryCta should suit: "${t.ctaFallback}". seoDescription under 155 characters.`;

  try {
    const content = await generateStructured({ store: opts.store, businessId: b.id, purpose: "content", schema: SiteContent, system: SYSTEM, prompt });
    return { content, source: "ai" };
  } catch (err) {
    opts.store.log(b.id, "ai_error", `content: ${(err as Error).message}`);
    return { content: fallbackContent(b), source: "heuristic" };
  }
}
