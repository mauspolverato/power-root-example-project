import { z } from "zod";

export const INDUSTRIES = [
  "restaurant",
  "cafe",
  "bar",
  "hotel",
  "barber",
  "salon",
  "gym",
  "clothing",
  "dental",
  "real_estate",
  "other",
] as const;
export const Industry = z.enum(INDUSTRIES);
export type Industry = z.infer<typeof Industry>;

/** A business as found by a discovery source, before any analysis. */
export const BusinessInput = z.object({
  name: z.string().min(1),
  industry: Industry,
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  openingHours: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  socials: z.record(z.string(), z.string()).default({}),
  /** WhatsApp number if different from phone (any format). */
  whatsapp: z.string().optional(),
  /** Site language override; otherwise derived from country. */
  language: z.enum(["es", "en"]).optional(),
  /** The business's own photos: local file paths or URLs, best first. */
  photos: z.array(z.string()).default([]),
  source: z.string(),
  sourceId: z.string(),
});
export type BusinessInput = z.infer<typeof BusinessInput>;

export interface Business extends BusinessInput {
  id: number;
}

export type IssueSeverity = "high" | "medium" | "low";
export interface AuditIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
}

/** Facts measured from the existing website. Every issue is backed by an observation. */
export interface WebsiteAudit {
  url: string | null;
  reachable: boolean;
  httpStatus: number | null;
  https: boolean;
  hasViewportMeta: boolean;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  imageCount: number;
  imagesMissingAlt: number;
  htmlBytes: number;
  responseMs: number | null;
  copyrightYear: number | null;
  generator: string | null;
  features: {
    booking: boolean;
    menu: boolean;
    contactForm: boolean;
    map: boolean;
    ecommerce: boolean;
    structuredData: boolean;
  };
  socialLinks: Record<string, string>;
  robotsDisallowed: boolean;
  issues: AuditIssue[];
  auditedAt: string;
}

/** Visual identity signals extracted from the existing site (no AI involved). */
export interface BrandSignals {
  colors: string[];
  fonts: string[];
  logoUrl: string | null;
  tagline: string | null;
  textSample: string;
  imageUrls: string[];
}

export const DesignBrief = z.object({
  positioning: z.string().describe("One sentence: who the business serves and how it wants to be seen"),
  audience: z.string(),
  toneOfVoice: z.string().describe("e.g. warm and familiar, refined and understated"),
  preserveExistingIdentity: z.boolean().describe("true when the current colors/logo are worth keeping"),
  palette: z.object({
    primary: z.string().describe("hex color"),
    secondary: z.string().describe("hex color"),
    accent: z.string().describe("hex color"),
    background: z.string().describe("hex color"),
    text: z.string().describe("hex color"),
  }),
  typography: z.object({
    heading: z.string().describe("A Google Fonts family name"),
    body: z.string().describe("A Google Fonts family name"),
  }),
  style: z.enum(["editorial", "bold", "minimal", "warm", "luxury", "playful"]),
  layout: z.object({
    hero: z.enum(["split", "centered", "fullbleed"]),
    sectionOrder: z.array(z.string()).describe("ordered section ids chosen from the industry's available sections"),
  }),
  imageryDirection: z.string(),
  reasons: z.array(z.string()).describe("why these choices fit this specific business"),
});
export type DesignBrief = z.infer<typeof DesignBrief>;

export const SiteContent = z.object({
  heroHeadline: z.string(),
  heroSubheadline: z.string(),
  primaryCta: z.string(),
  about: z.string(),
  highlights: z.array(z.object({ title: z.string(), text: z.string() })),
  services: z.array(z.object({ name: z.string(), description: z.string(), price: z.string().nullable() })),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  seoTitle: z.string(),
  seoDescription: z.string(),
});
export type SiteContent = z.infer<typeof SiteContent>;

export interface LeadScore {
  score: number; // 0-100, higher = better prospect
  qualified: boolean;
  reasons: string[];
}

export interface PriceQuote {
  tier: "starter" | "business" | "commerce";
  features: string[];
  currency: string;
  symbol: string;
  oneTime: { price: number };
  subscription: { monthly: number; minimumMonths: number };
  hybrid: { setup: number; monthly: number };
  estimatedCosts: { buildHours: number; buildCost: number; aiCost: number; hostingMonthly: number; toolsMonthly: number };
  marginOneTime: number;
  marginMonthly: number;
  marketRange: { low: number; high: number; note: string };
  assumptions: string[];
}
