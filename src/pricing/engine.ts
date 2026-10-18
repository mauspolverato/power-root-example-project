import { localeFor, type Locale } from "../generator/i18n.ts";
import type { Business, PriceQuote, WebsiteAudit } from "../types.ts";

// Suggested prices for the three revenue models. Every number here is an
// assumption you should replace with your own as soon as you have real data
// (time spent per site, close rate by price). Internal math is in USD; each
// market defines its display currency and local price level.

export interface Market {
  currency: "USD" | "EUR" | "GBP";
  symbol: string;
  factor: number; // local price level, 1 = US/Western Europe agency-freelancer average
  rangeNote: string;
}

const EU = (factor: number): Market => ({ currency: "EUR", symbol: "€", factor, rangeNote: "Typical small-business range: DIY builders €15-40/month (client does the work), freelancers ~€500-1,500, agencies €2,000+." });

export const MARKETS: Record<string, Market> = {
  VE: { currency: "USD", symbol: "$", factor: 0.3, rangeNote: "Venezuela (rough estimate — verify with 5-10 local offers): freelancers often charge ~$100-500 for a simple site; agencies $600+. Most businesses currently rely on Instagram + WhatsApp only." },
  CO: { currency: "USD", symbol: "$", factor: 0.4, rangeNote: "Colombia (rough estimate — verify locally)." },
  US: { currency: "USD", symbol: "$", factor: 1.2, rangeNote: "Typical US small-business range: DIY builders $16-45/month, freelancers ~$800-2,500, agencies $3,000+." },
  GB: { currency: "GBP", symbol: "£", factor: 0.95, rangeNote: "Typical UK range: freelancers ~£500-1,500, agencies £2,000+." },
  IT: EU(0.8), ES: EU(0.8), PT: EU(0.75), DE: EU(1.0), FR: EU(0.95), NL: EU(1.0),
};
const DEFAULT_MARKET: Market = { currency: "USD", symbol: "$", factor: 1, rangeNote: "No market data for this country — set one in src/pricing/engine.ts." };

export function marketFor(country: string | undefined): Market {
  return (country && MARKETS[country.toUpperCase()]) || DEFAULT_MARKET;
}

export const PRICING_ASSUMPTIONS = {
  // What an hour of YOUR time is worth to you, in USD. Override with HOURLY_COST_USD.
  hourlyCost: Number(process.env.HOURLY_COST_USD) || 20,
  hoursByTier: { starter: 4, business: 8, commerce: 16 }, // human time after automation: content, edits, QA, launch
  maintenanceHoursPerMonth: { starter: 0.25, business: 0.5, commerce: 1.5 }, // static sites need little upkeep
  hostingMonthly: { starter: 0, business: 0, commerce: 0 }, // static hosting on Cloudflare Pages/Netlify free tiers
  toolsMonthly: { starter: 2, business: 4, commerce: 8 }, // uptime monitoring, backups, share of paid tools
  // Base prices at factor 1, in the market's currency.
  basePrice: {
    starter: { oneTime: 690, monthly: 49, setup: 290, hybridMonthly: 29 },
    business: { oneTime: 1290, monthly: 79, setup: 490, hybridMonthly: 49 },
    commerce: { oneTime: 2490, monthly: 149, setup: 990, hybridMonthly: 99 },
  },
  minimumMonths: 12,
};

// Rough conversion so costs (USD) and prices (local currency) can be compared.
const USD_PER: Record<Market["currency"], number> = { USD: 1, EUR: 1.08, GBP: 1.27 };

/** Round to a friendly price ending in 90 or 9 (e.g. 587 -> 590, 1213 -> 1190, 52 -> 49). */
export function friendly(n: number): number {
  if (n < 100) return Math.max(9, Math.round(n / 5) * 5 - 1);
  const step = n < 1000 ? 50 : 100;
  return Math.round(n / step) * step - 10;
}

const FEATURES: Record<Locale, { base: string[]; shop: string[]; food: string; hotel: string; services: string; bookingTool: string; whatsapp: string }> = {
  en: {
    base: ["Custom design based on your brand", "Fast, mobile-first site", "Google-friendly setup (SEO basics + business markup)", "Contact details, opening hours & map", "Privacy notice"],
    shop: ["Online shop (catalog, cart, checkout via Stripe/Shopify)", "Product photo layout"],
    food: "Menu page + reservation requests",
    hotel: "Rooms page + availability requests",
    services: "Services page + appointment requests",
    bookingTool: "Integration with your booking tool if you have one",
    whatsapp: "Requests arrive on your WhatsApp, already written out",
  },
  es: {
    base: ["Diseño a la medida de tu marca", "Sitio rápido, pensado primero para el celular", "Preparado para Google (SEO básico + ficha del negocio)", "Datos de contacto, horario y mapa", "Aviso de privacidad"],
    shop: ["Tienda en línea (catálogo y pedidos)", "Diseño para fotos de productos"],
    food: "Página de menú + solicitudes de reserva",
    hotel: "Página de habitaciones + consultas de disponibilidad",
    services: "Página de servicios + solicitudes de cita",
    bookingTool: "Conexión con tu sistema de reservas si ya tienes uno",
    whatsapp: "Las solicitudes te llegan directo a tu WhatsApp, ya redactadas",
  },
};

export function chooseTier(b: Business, audit: WebsiteAudit | null): { tier: PriceQuote["tier"]; features: string[] } {
  const f = FEATURES[localeFor(b)];
  const base = b.phone || b.whatsapp ? [...f.base, f.whatsapp] : f.base;
  if (b.industry === "clothing" || audit?.features.ecommerce) return { tier: "commerce", features: [...base, ...f.shop] };
  if (["restaurant", "bar", "hotel", "barber", "salon", "dental", "gym", "real_estate"].includes(b.industry)) {
    const extra = b.industry === "restaurant" || b.industry === "bar" ? f.food : b.industry === "hotel" ? f.hotel : f.services;
    return { tier: "business", features: [...base, extra, f.bookingTool] };
  }
  return { tier: "starter", features: base };
}

export function quote(b: Business, audit: WebsiteAudit | null, aiCostUsd = 0): PriceQuote {
  const a = PRICING_ASSUMPTIONS;
  const market = marketFor(b.country);
  const { tier, features } = chooseTier(b, audit);
  const base = a.basePrice[tier];
  const toUsd = USD_PER[market.currency];

  const buildHours = a.hoursByTier[tier];
  const buildCost = buildHours * a.hourlyCost;
  const aiCost = Math.round(aiCostUsd * 100) / 100;
  const monthlyCost = a.maintenanceHoursPerMonth[tier] * a.hourlyCost + a.hostingMonthly[tier] + a.toolsMonthly[tier];

  const oneTime = friendly(base.oneTime * market.factor);
  const monthly = friendly(base.monthly * market.factor);
  const setup = friendly(base.setup * market.factor);
  const hybridMonthly = friendly(base.hybridMonthly * market.factor);

  const assumptions = [
    `Your time valued at $${a.hourlyCost}/h (set HOURLY_COST_USD); ${buildHours}h of human work to finish and launch this tier.`,
    `Hosting on a free static tier; $${a.toolsMonthly[tier]}/month for monitoring/backup tools; ${a.maintenanceHoursPerMonth[tier]}h/month maintenance.`,
    `Market ${b.country ?? "unknown"}: prices in ${market.currency}, local price level ${market.factor}.`,
    `Subscription assumes a ${a.minimumMonths}-month minimum term.`,
    "Domain registration and third-party booking/shop subscriptions are paid by the client and not included.",
  ];

  return {
    tier,
    features,
    currency: market.currency,
    symbol: market.symbol,
    oneTime: { price: oneTime },
    subscription: { monthly, minimumMonths: a.minimumMonths },
    hybrid: { setup, monthly: hybridMonthly },
    estimatedCosts: { buildHours, buildCost, aiCost, hostingMonthly: a.hostingMonthly[tier], toolsMonthly: a.toolsMonthly[tier] },
    marginOneTime: Math.round(((oneTime * toUsd - buildCost - aiCost) / (oneTime * toUsd)) * 100),
    marginMonthly: Math.round(((monthly * toUsd - monthlyCost) / (monthly * toUsd)) * 100),
    marketRange: { low: Math.round(500 * market.factor), high: Math.round(4000 * market.factor), note: market.rangeNote },
    assumptions,
  };
}
