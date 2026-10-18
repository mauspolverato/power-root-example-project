import type { DesignBrief, Industry } from "../types.ts";

// Industry knowledge: which sections make sense, sensible design starting
// points, and placeholder copy used when no AI is available. The AI brief
// picks and reorders from `sections`; it cannot invent sections we can't render.

export const SECTION_IDS = ["hero", "about", "highlights", "offer", "gallery", "booking", "hours_location", "faq", "contact"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface IndustryProfile {
  label: string;
  offerLabel: string; // what the "offer" section is called: Menu, Services, Rooms...
  offerPage: string; // slug of the dedicated offer page
  bookingLabel: string | null; // null = no booking section for this industry
  ctaFallback: string;
  sections: SectionId[];
  styles: DesignBrief["style"][];
  palettes: DesignBrief["palette"][];
  fontPairs: DesignBrief["typography"][];
  features: string[]; // shown in proposals and used for pricing
  fallback: {
    highlights: { title: string; text: string }[];
    services: { name: string; description: string }[];
    faq: { q: string; a: string }[];
  };
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

const hospitalityFaq = [
  { q: "Do I need to book in advance?", a: "Walk-ins are welcome when there is space; booking ahead guarantees your table, especially on weekends." },
  { q: "Do you cater for dietary requirements?", a: "Let us know about allergies or dietary needs when you book and we'll do our best to accommodate you." },
];
const appointmentFaq = [
  { q: "How do I book an appointment?", a: "Use the booking form or call us. We'll confirm your slot as soon as possible." },
  { q: "What if I need to cancel?", a: "Please let us know as early as you can so we can offer the slot to someone else." },
];

export const INDUSTRY_PROFILES: Record<Industry, IndustryProfile> = {
  restaurant: {
    label: "Restaurant",
    offerLabel: "Menu",
    offerPage: "menu",
    bookingLabel: "Reserve a table",
    ctaFallback: "Book a table",
    sections: ["hero", "about", "offer", "highlights", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["warm", "editorial", "luxury"],
    palettes: warmPalettes,
    fontPairs: serifPairs,
    features: ["Online menu", "Reservation requests", "Opening hours & map", "Photo gallery", "Mobile-first design", "Local SEO"],
    fallback: {
      highlights: [
        { title: "Seasonal cooking", text: "Dishes built around what's fresh and good right now." },
        { title: "A place to linger", text: "Relaxed service, good company and room to take your time." },
        { title: "Made for occasions", text: "From weeknight dinners to celebrations with friends." },
      ],
      services: [
        { name: "Starters", description: "A rotating selection of small plates to share." },
        { name: "Mains", description: "Our signature dishes, prepared fresh to order." },
        { name: "Desserts", description: "Something sweet to finish." },
      ],
      faq: hospitalityFaq,
    },
  },
  cafe: {
    label: "Café",
    offerLabel: "Menu",
    offerPage: "menu",
    bookingLabel: null,
    ctaFallback: "See the menu",
    sections: ["hero", "about", "offer", "highlights", "gallery", "hours_location", "faq", "contact"],
    styles: ["warm", "minimal", "playful"],
    palettes: warmPalettes,
    fontPairs: [...sansPairs, ...serifPairs],
    features: ["Online menu", "Opening hours & map", "Photo gallery", "Mobile-first design", "Local SEO"],
    fallback: {
      highlights: [
        { title: "Good coffee", text: "Carefully prepared, every cup." },
        { title: "Baked daily", text: "Fresh pastries and treats from the morning on." },
        { title: "Stay a while", text: "A friendly spot to meet, work or slow down." },
      ],
      services: [
        { name: "Coffee & tea", description: "Espresso drinks, filter coffee and loose-leaf teas." },
        { name: "Breakfast", description: "Simple, satisfying plates to start the day." },
        { name: "Cakes & pastries", description: "Baked fresh and changing with the season." },
      ],
      faq: [{ q: "Do you have seating?", a: "Yes — come in and make yourself comfortable." }],
    },
  },
  bar: {
    label: "Bar",
    offerLabel: "Drinks",
    offerPage: "drinks",
    bookingLabel: "Book a table",
    ctaFallback: "Book a table",
    sections: ["hero", "highlights", "offer", "gallery", "about", "booking", "hours_location", "faq", "contact"],
    styles: ["bold", "luxury", "editorial"],
    palettes: boldPalettes,
    fontPairs: boldPairs,
    features: ["Drinks menu", "Table/event booking requests", "Events section", "Opening hours & map", "Mobile-first design"],
    fallback: {
      highlights: [
        { title: "Crafted drinks", text: "Classics done right and house creations worth the trip." },
        { title: "Atmosphere", text: "Good music, good people, good nights." },
        { title: "Private events", text: "Ask us about hosting your next celebration." },
      ],
      services: [
        { name: "Cocktails", description: "House signatures and timeless classics." },
        { name: "Wine & beer", description: "A considered selection by the glass and bottle." },
        { name: "Bites", description: "Small plates to share." },
      ],
      faq: [{ q: "Can I book for a group?", a: "Yes — send us a booking request with your group size and date." }],
    },
  },
  hotel: {
    label: "Hotel",
    offerLabel: "Rooms",
    offerPage: "rooms",
    bookingLabel: "Check availability",
    ctaFallback: "Check availability",
    sections: ["hero", "about", "offer", "gallery", "highlights", "booking", "hours_location", "faq", "contact"],
    styles: ["luxury", "editorial", "minimal"],
    palettes: [...cleanPalettes, ...warmPalettes],
    fontPairs: serifPairs,
    features: ["Room showcase", "Availability requests", "Booking-engine integration ready", "Multilingual-ready", "Location & directions", "Local SEO"],
    fallback: {
      highlights: [
        { title: "Comfortable rooms", text: "Quiet, clean and thoughtfully furnished." },
        { title: "Great location", text: "Close to what you came to see." },
        { title: "Personal service", text: "A small team that takes care of you." },
      ],
      services: [
        { name: "Double room", description: "A comfortable room for two." },
        { name: "Twin room", description: "Two single beds, ideal for friends or colleagues." },
        { name: "Family room", description: "Space for the whole family." },
      ],
      faq: [
        { q: "What time is check-in?", a: "Contact us and we'll confirm check-in and check-out times for your stay." },
        { q: "Is breakfast included?", a: "Ask us when you enquire — we'll tell you what's included with your room." },
      ],
    },
  },
  barber: {
    label: "Barber",
    offerLabel: "Services",
    offerPage: "services",
    bookingLabel: "Book an appointment",
    ctaFallback: "Book now",
    sections: ["hero", "offer", "about", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["bold", "editorial", "minimal"],
    palettes: boldPalettes,
    fontPairs: boldPairs,
    features: ["Service & price list", "Appointment booking", "Gallery of cuts", "Opening hours & map", "Mobile-first design"],
    fallback: {
      highlights: [
        { title: "Sharp cuts", text: "Classic and modern styles, done properly." },
        { title: "Hot towel shaves", text: "The full treatment." },
        { title: "No rush", text: "We take the time to get it right." },
      ],
      services: [
        { name: "Haircut", description: "Consultation, cut and style." },
        { name: "Beard trim", description: "Shape-up and tidy." },
        { name: "Cut & beard", description: "The complete look." },
      ],
      faq: appointmentFaq,
    },
  },
  salon: {
    label: "Salon",
    offerLabel: "Treatments",
    offerPage: "treatments",
    bookingLabel: "Book an appointment",
    ctaFallback: "Book now",
    sections: ["hero", "about", "offer", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["minimal", "luxury", "warm"],
    palettes: [...cleanPalettes, ...warmPalettes],
    fontPairs: [...serifPairs, ...sansPairs],
    features: ["Treatment & price list", "Appointment booking", "Gallery", "Opening hours & map", "Mobile-first design"],
    fallback: {
      highlights: [
        { title: "Expert team", text: "Experienced stylists who listen." },
        { title: "Quality products", text: "Professional care for your hair and skin." },
        { title: "Relaxed space", text: "Take a moment for yourself." },
      ],
      services: [
        { name: "Cut & style", description: "Tailored to you." },
        { name: "Colour", description: "From subtle refresh to full transformation." },
        { name: "Treatments", description: "Care and repair." },
      ],
      faq: appointmentFaq,
    },
  },
  gym: {
    label: "Gym",
    offerLabel: "Memberships & classes",
    offerPage: "memberships",
    bookingLabel: "Book a free trial",
    ctaFallback: "Start your trial",
    sections: ["hero", "highlights", "offer", "about", "gallery", "booking", "hours_location", "faq", "contact"],
    styles: ["bold", "playful", "minimal"],
    palettes: boldPalettes,
    fontPairs: boldPairs,
    features: ["Membership plans", "Class timetable", "Trial booking requests", "Opening hours & map", "Mobile-first design"],
    fallback: {
      highlights: [
        { title: "Train your way", text: "Equipment and space for strength, cardio and everything between." },
        { title: "Classes", text: "Group sessions to keep you motivated." },
        { title: "Coaching", text: "Support from people who know what they're doing." },
      ],
      services: [
        { name: "Monthly membership", description: "Full access to the gym floor." },
        { name: "Classes", description: "Group training sessions throughout the week." },
        { name: "Personal training", description: "One-to-one coaching." },
      ],
      faq: [{ q: "Can I try before I join?", a: "Yes — request a trial session and we'll show you around." }],
    },
  },
  clothing: {
    label: "Clothing store",
    offerLabel: "Collections",
    offerPage: "shop",
    bookingLabel: null,
    ctaFallback: "Shop the collection",
    sections: ["hero", "offer", "about", "gallery", "highlights", "hours_location", "faq", "contact"],
    styles: ["editorial", "minimal", "bold"],
    palettes: [...cleanPalettes, ...boldPalettes],
    fontPairs: [...serifPairs, ...sansPairs],
    features: ["Product catalog", "E-commerce ready (Shopify/Stripe)", "Lookbook gallery", "Store hours & map", "Mobile-first design"],
    fallback: {
      highlights: [
        { title: "Curated pieces", text: "Chosen with care, made to last." },
        { title: "Personal styling", text: "Come in and we'll help you find your fit." },
        { title: "New arrivals", text: "Fresh pieces every season." },
      ],
      services: [
        { name: "Women", description: "Everyday essentials and statement pieces." },
        { name: "Men", description: "Modern classics." },
        { name: "Accessories", description: "The finishing touches." },
      ],
      faq: [{ q: "Do you offer returns?", a: "Ask in store or contact us about our returns policy." }],
    },
  },
  dental: {
    label: "Dental clinic",
    offerLabel: "Treatments",
    offerPage: "treatments",
    bookingLabel: "Request an appointment",
    ctaFallback: "Request an appointment",
    sections: ["hero", "highlights", "offer", "about", "booking", "hours_location", "faq", "contact"],
    styles: ["minimal", "editorial", "warm"],
    palettes: cleanPalettes,
    fontPairs: sansPairs,
    features: ["Treatment pages", "Appointment requests", "New-patient information", "Opening hours & map", "Accessibility-first", "Local SEO"],
    fallback: {
      highlights: [
        { title: "Gentle care", text: "We put your comfort first." },
        { title: "Modern dentistry", text: "Up-to-date techniques and equipment." },
        { title: "For the whole family", text: "Care for patients of every age." },
      ],
      services: [
        { name: "Check-ups & hygiene", description: "Regular care to keep your smile healthy." },
        { name: "Restorative treatments", description: "Fillings, crowns and more." },
        { name: "Cosmetic dentistry", description: "Whitening and smile improvements." },
      ],
      faq: [
        { q: "Are you accepting new patients?", a: "Contact us and we'll let you know about availability." },
        { q: "What should I do in an emergency?", a: "Call us as soon as possible and we'll advise you on next steps." },
      ],
    },
  },
  real_estate: {
    label: "Real estate agency",
    offerLabel: "Services",
    offerPage: "services",
    bookingLabel: "Book a valuation",
    ctaFallback: "Book a free valuation",
    sections: ["hero", "offer", "highlights", "about", "booking", "hours_location", "faq", "contact"],
    styles: ["luxury", "minimal", "editorial"],
    palettes: cleanPalettes,
    fontPairs: [...serifPairs, ...sansPairs],
    features: ["Property listings section", "Valuation requests", "Agent profiles", "Office location & map", "Local SEO"],
    fallback: {
      highlights: [
        { title: "Local knowledge", text: "We know the area and its market." },
        { title: "Honest advice", text: "Clear guidance from first viewing to completion." },
        { title: "Buyers & sellers", text: "Support on both sides of the move." },
      ],
      services: [
        { name: "Sales", description: "Marketing your property to the right buyers." },
        { name: "Lettings", description: "Finding reliable tenants." },
        { name: "Valuations", description: "An informed view of what your property is worth." },
      ],
      faq: [{ q: "How much is my property worth?", a: "Request a valuation and we'll give you an informed estimate." }],
    },
  },
  other: {
    label: "Local business",
    offerLabel: "Services",
    offerPage: "services",
    bookingLabel: null,
    ctaFallback: "Get in touch",
    sections: ["hero", "about", "offer", "highlights", "gallery", "hours_location", "faq", "contact"],
    styles: ["minimal", "warm", "editorial"],
    palettes: [...cleanPalettes, ...warmPalettes],
    fontPairs: sansPairs,
    features: ["Services overview", "Contact form", "Opening hours & map", "Mobile-first design", "Local SEO"],
    fallback: {
      highlights: [
        { title: "Local", text: "Part of the neighbourhood." },
        { title: "Personal", text: "Real people who care about their work." },
        { title: "Reliable", text: "We do what we say." },
      ],
      services: [
        { name: "Our services", description: "Get in touch to find out how we can help." },
      ],
      faq: [{ q: "How can I contact you?", a: "Use the contact details on this page." }],
    },
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
