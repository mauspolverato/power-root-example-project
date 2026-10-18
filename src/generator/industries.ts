import type { DesignBrief, Industry } from "../types.ts";

// Industry design knowledge: which sections make sense and sensible design
// starting points (visible text lives in i18n.ts). The AI brief
// picks and reorders from `sections`; it cannot invent sections we can't render.

export const SECTION_IDS = ["hero", "about", "highlights", "offer", "gallery", "booking", "hours_location", "faq", "contact"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface IndustryProfile {
  sections: SectionId[];
  styles: DesignBrief["style"][];
  palettes: DesignBrief["palette"][];
  fontPairs: DesignBrief["typography"][];
  features: string[]; // shown in proposals and used for pricing
}

const warmPalettes: DesignBrief["palette"][] = [
  { primary: "#7a2e1f", secondary: "#e9d8c4", accent: "#c8913a", background: "#fbf7f2", text: "#2a1d17" },
  { primary: "#2f4a3a", secondary: "#e4e9df", accent: "#d08c3f", background: "#f8f7f2", text: "#1d2520" },
  { primary: "#1f2a44", secondary: "#efe6d8", accent: "#c4553a", background: "#fdfaf5", text: "#1a1d26" },
];
const cleanPalettes: DesignBrief["palette"][] = [
  { primary: "#0f4c5c", secondary: "#e6f0f2", accent: "#e36414", background: "#ffffff", text: "#14232a" },
  { primary: "#1b3a6b", secondary: "#e8eef7", accent: "#2bb3a3", background: "#fbfcfe", text: "#141c2b" },
  { primary: "#24323f", secondary: "#eef1f4", accent: "#c9a227", background: "#ffffff", text: "#151b21" },
];
const boldPalettes: DesignBrief["palette"][] = [
  { primary: "#111111", secondary: "#f2f2f2", accent: "#e63946", background: "#fafafa", text: "#111111" },
  { primary: "#1a1a2e", secondary: "#ececf3", accent: "#f4a300", background: "#ffffff", text: "#12121c" },
  { primary: "#0b3d2e", secondary: "#e9f2ee", accent: "#ff6b35", background: "#fbfdfc", text: "#0d1a15" },
];

const serifPairs: DesignBrief["typography"][] = [
  { heading: "Playfair Display", body: "Source Sans 3" },
  { heading: "Cormorant Garamond", body: "Lato" },
  { heading: "Fraunces", body: "Inter" },
];
const sansPairs: DesignBrief["typography"][] = [
  { heading: "Manrope", body: "Inter" },
  { heading: "DM Sans", body: "DM Sans" },
  { heading: "Outfit", body: "Nunito Sans" },
];
const boldPairs: DesignBrief["typography"][] = [
  { heading: "Bebas Neue", body: "Barlow" },
  { heading: "Archivo Black", body: "Archivo" },
  { heading: "Oswald", body: "Work Sans" },
];

export const INDUSTRY_PROFILES: Record<Industry, IndustryProfile> = {
  restaurant: {
    sections: ["hero", "about", "offer", "highlights", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["warm", "editorial", "luxury"],
    palettes: warmPalettes,
    fontPairs: serifPairs,
    features: ["Online menu", "Reservation requests", "Opening hours & map", "Photo gallery", "Mobile-first design", "Local SEO"],
  },
  cafe: {
    sections: ["hero", "about", "offer", "highlights", "gallery", "hours_location", "faq", "contact"],
    styles: ["warm", "minimal", "playful"],
    palettes: warmPalettes,
    fontPairs: [...sansPairs, ...serifPairs],
    features: ["Online menu", "Opening hours & map", "Photo gallery", "Mobile-first design", "Local SEO"],
  },
  bar: {
    sections: ["hero", "highlights", "offer", "gallery", "about", "booking", "hours_location", "faq", "contact"],
    styles: ["bold", "luxury", "editorial"],
    palettes: boldPalettes,
    fontPairs: boldPairs,
    features: ["Drinks menu", "Table/event booking requests", "Events section", "Opening hours & map", "Mobile-first design"],
  },
  hotel: {
    sections: ["hero", "about", "offer", "gallery", "highlights", "booking", "hours_location", "faq", "contact"],
    styles: ["luxury", "editorial", "minimal"],
    palettes: [...cleanPalettes, ...warmPalettes],
    fontPairs: serifPairs,
    features: ["Room showcase", "Availability requests", "Booking-engine integration ready", "Multilingual-ready", "Location & directions", "Local SEO"],
  },
  barber: {
    sections: ["hero", "offer", "about", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["bold", "editorial", "minimal"],
    palettes: boldPalettes,
    fontPairs: boldPairs,
    features: ["Service & price list", "Appointment booking", "Gallery of cuts", "Opening hours & map", "Mobile-first design"],
  },
  salon: {
    sections: ["hero", "about", "offer", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["minimal", "luxury", "warm"],
    palettes: [...cleanPalettes, ...warmPalettes],
    fontPairs: [...serifPairs, ...sansPairs],
    features: ["Treatment & price list", "Appointment booking", "Gallery", "Opening hours & map", "Mobile-first design"],
  },
  gym: {
    sections: ["hero", "highlights", "offer", "about", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["bold", "playful", "minimal"],
    palettes: boldPalettes,
    fontPairs: boldPairs,
    features: ["Membership plans", "Class timetable", "Trial booking requests", "Opening hours & map", "Mobile-first design"],
  },
  clothing: {
    sections: ["hero", "offer", "about", "gallery", "highlights", "hours_location", "faq", "contact"],
    styles: ["editorial", "minimal", "bold"],
    palettes: [...cleanPalettes, ...boldPalettes],
    fontPairs: [...serifPairs, ...sansPairs],
    features: ["Product catalog", "E-commerce ready (Shopify/Stripe)", "Lookbook gallery", "Store hours & map", "Mobile-first design"],
  },
  dental: {
    sections: ["hero", "highlights", "offer", "about", "booking", "hours_location", "faq", "contact"],
    styles: ["minimal", "editorial", "warm"],
    palettes: cleanPalettes,
    fontPairs: sansPairs,
    features: ["Treatment pages", "Appointment requests", "New-patient information", "Opening hours & map", "Accessibility-first", "Local SEO"],
  },
  real_estate: {
    sections: ["hero", "offer", "highlights", "about", "booking", "hours_location", "faq", "contact"],
    styles: ["luxury", "minimal", "editorial"],
    palettes: cleanPalettes,
    fontPairs: [...serifPairs, ...sansPairs],
    features: ["Property listings section", "Valuation requests", "Agent profiles", "Office location & map", "Local SEO"],
  },
  manufacturer: {
    sections: ["hero", "offer", "highlights", "about", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["bold", "minimal", "editorial"],
    palettes: [...cleanPalettes, ...boldPalettes],
    fontPairs: [...sansPairs, ...boldPairs],
    features: ["Products & services pages", "Quote requests", "Project gallery", "Location & directions", "Local SEO"],
  },
  other: {
    sections: ["hero", "about", "offer", "highlights", "gallery", "hours_location", "faq", "contact"],
    styles: ["minimal", "warm", "editorial"],
    palettes: [...cleanPalettes, ...warmPalettes],
    fontPairs: sansPairs,
    features: ["Services overview", "Contact form", "Opening hours & map", "Mobile-first design", "Local SEO"],
  },
};

/** Stable small hash so the same business always gets the same design variant. */
export function stableHash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function pick<T>(items: readonly T[], seed: number, salt = 0): T {
  return items[(seed + salt * 7919) % items.length]!;
}
