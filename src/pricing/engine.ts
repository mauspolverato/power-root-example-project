import type { Business, PriceQuote, WebsiteAudit } from "../types.ts";

// Suggested prices for the three revenue models. Every number here is an
// assumption you should replace with your own as soon as you have real data
// (time spent per site, close rate by price). Prices are in EUR.

export const PRICING_ASSUMPTIONS = {
  hourlyCost: 35, // what an hour of YOUR time is worth to you
  hoursByTier: { starter: 4, business: 8, commerce: 16 }, // human time after automation: content, edits, QA, launch
  maintenanceHoursPerMonth: { starter: 0.5, business: 1, commerce: 2 },
  hostingMonthly: { starter: 0, business: 0, commerce: 0 }, // static hosting on Cloudflare Pages/Netlify free tiers
  toolsMonthly: { starter: 2, business: 4, commerce: 8 }, // uptime monitoring, backups, email forwarding, share of paid tools
  basePrice: {
    starter: { oneTime: 690, monthly: 49, setup: 290, hybridMonthly: 29 },
    business: { oneTime: 1290, monthly: 79, setup: 490, hybridMonthly: 49 },
    commerce: { oneTime: 2490, monthly: 149, setup: 990, hybridMonthly: 99 },
  },
  // Rough local price levels for small-business web services; 1 = Western EU average.
  countryFactor: { IT: 0.85, ES: 0.85, PT: 0.8, GR: 0.8, PL: 0.7, DE: 1.1, AT: 1.05, FR: 1.05, NL: 1.1, BE: 1.05, GB: 1.15, IE: 1.1, CH: 1.5, US: 1.25 } as Record<string, number>,
  minimumMonths: 12,
};

/** Round to a friendly price ending in 90 or 9 (e.g. 587 -> 590, 1213 -> 1190, 52 -> 49). */
export function friendly(n: number): number {
  if (n < 100) return Math.max(9, Math.round(n / 5) * 5 - 1);
  const step = n < 1000 ? 50 : 100;
  return Math.round(n / step) * step - 10;
}

export function chooseTier(b: Business, audit: WebsiteAudit | null): { tier: PriceQuote["tier"]; features: string[] } {
  const features = ["Custom design based on your brand", "Mobile-first, fast static site", "SEO basics + local business markup", "Contact details, hours & map", "Privacy notice template"];
  if (b.industry === "clothing" || audit?.features.ecommerce) {
    return { tier: "commerce", features: [...features, "Online shop (catalog, cart, checkout via Stripe/Shopify)", "Product photo layout"] };
  }
  if (["restaurant", "bar", "hotel", "barber", "salon", "dental", "gym", "real_estate"].includes(b.industry)) {
    const extra = b.industry === "restaurant" || b.industry === "bar" ? "Menu page + reservation requests" : b.industry === "hotel" ? "Rooms page + availability requests" : "Services page + appointment requests";
    return { tier: "business", features: [...features, extra, "Integration with your booking tool if you have one"] };
  }
  return { tier: "starter", features };
}

export function quote(b: Business, audit: WebsiteAudit | null, aiCostUsd = 0): PriceQuote {
  const a = PRICING_ASSUMPTIONS;
  const { tier, features } = chooseTier(b, audit);
  const factor = (b.country && a.countryFactor[b.country.toUpperCase()]) || 1;
  const base = a.basePrice[tier];

  const buildHours = a.hoursByTier[tier];
  const buildCost = buildHours * a.hourlyCost;
  const aiCost = Math.round(aiCostUsd * 0.92 * 100) / 100; // USD -> EUR, approximate
  const monthlyCost = a.maintenanceHoursPerMonth[tier] * a.hourlyCost + a.hostingMonthly[tier] + a.toolsMonthly[tier];

  const oneTime = friendly(base.oneTime * factor);
  const monthly = friendly(base.monthly * factor);
  const setup = friendly(base.setup * factor);
  const hybridMonthly = friendly(base.hybridMonthly * factor);

  const assumptions = [
    `Your time valued at €${a.hourlyCost}/h; ${buildHours}h of human work to finish and launch this tier.`,
    `Hosting on a free static tier; €${a.toolsMonthly[tier]}/month for monitoring/backup tools; ${a.maintenanceHoursPerMonth[tier]}h/month maintenance.`,
    `Local price level factor ${factor} for ${b.country ?? "unknown country"}.`,
    `Subscription assumes a ${a.minimumMonths}-month minimum term.`,
    "Domain registration and third-party booking/shop subscriptions are paid by the client and not included.",
  ];

  return {
    tier,
    features,
    oneTime: { price: oneTime },
    subscription: { monthly, minimumMonths: a.minimumMonths },
    hybrid: { setup, monthly: hybridMonthly },
    estimatedCosts: { buildHours, buildCost, aiCost, hostingMonthly: a.hostingMonthly[tier], toolsMonthly: a.toolsMonthly[tier] },
    marginOneTime: Math.round(((oneTime - buildCost - aiCost) / oneTime) * 100),
    marginMonthly: Math.round(((monthly - monthlyCost) / monthly) * 100),
    marketRange: {
      low: Math.round(500 * factor),
      high: Math.round(4000 * factor),
      note: "Typical small-business range: DIY builders €15-40/month (client does the work), freelancers ~€500-1,500, agencies €2,000+. Verify against 5-10 local competitors before relying on it.",
    },
    assumptions,
  };
}
