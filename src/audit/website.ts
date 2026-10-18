import * as cheerio from "cheerio";
import { config } from "../config.ts";
import type { AuditIssue, WebsiteAudit } from "../types.ts";

// Audits one public page — the homepage — the way a visitor's browser would
// see it. We respect robots.txt and fetch a single page per business, so this
// is lighter than a search-engine crawl.

const SOCIAL_HOSTS: Record<string, RegExp> = {
  instagram: /instagram\.com/i,
  facebook: /facebook\.com|fb\.com/i,
  tiktok: /tiktok\.com/i,
  twitter: /twitter\.com|x\.com/i,
  linkedin: /linkedin\.com/i,
  youtube: /youtube\.com/i,
  tripadvisor: /tripadvisor\./i,
};

export function normalizeUrl(raw: string): string {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return new URL(withScheme).toString();
}

/** Returns true when robots.txt disallows "/" for all agents or for our agent. */
export async function robotsDisallowsHome(url: string): Promise<boolean> {
  try {
    const res = await fetch(new URL("/robots.txt", url), {
      headers: { "user-agent": config.userAgent },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    return parseRobotsDisallowsRoot(await res.text(), "AgencyAuditBot");
  } catch {
    return false;
  }
}

export function parseRobotsDisallowsRoot(robots: string, agent: string): boolean {
  let applies = false;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [k, ...rest] = line.split(":");
    const key = k?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      // Consecutive user-agent lines form one group.
      if (!lastWasAgent) applies = false;
      if (value === "*" || value.toLowerCase() === agent.toLowerCase()) applies = true;
      lastWasAgent = true;
    } else if (key) {
      lastWasAgent = false;
      if (applies && key === "disallow" && value === "/") return true;
    }
  }
  return false;
}

export async function fetchPage(url: string): Promise<{ status: number; html: string; finalUrl: string; ms: number }> {
  const started = Date.now();
  const res = await fetch(url, {
    headers: { "user-agent": config.userAgent, accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  const html = await res.text();
  return { status: res.status, html: html.slice(0, 3_000_000), finalUrl: res.url || url, ms: Date.now() - started };
}

export function analyzeHtml(html: string, finalUrl: string): Omit<WebsiteAudit, "reachable" | "httpStatus" | "responseMs" | "robotsDisallowed" | "auditedAt" | "issues"> {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const lower = html.toLowerCase();
  const years = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));

  const socialLinks: Record<string, string> = {};
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    for (const [name, re] of Object.entries(SOCIAL_HOSTS)) {
      if (re.test(href) && !socialLinks[name]) socialLinks[name] = href;
    }
  });

  const images = $("img");
  return {
    url: finalUrl,
    https: finalUrl.startsWith("https://"),
    hasViewportMeta: $('meta[name="viewport"]').length > 0,
    title: $("title").first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || null,
    h1Count: $("h1").length,
    imageCount: images.length,
    imagesMissingAlt: images.filter((_, img) => !$(img).attr("alt")?.trim()).length,
    htmlBytes: Buffer.byteLength(html),
    copyrightYear: years.length ? Math.max(...years) : null,
    generator: $('meta[name="generator"]').attr("content") ?? null,
    features: {
      booking: /book(ing)?\s*(now|online|a table|appointment)|reserv|prenota|opentable|thefork|resy\.com|calendly|fresha|booksy|treatwell/i.test(text + lower),
      menu: /\bmenu\b|carta|speisekarte|menù/i.test(text),
      contactForm: $("form").filter((_, f) => /email|message|contact/i.test($(f).html() ?? "")).length > 0,
      map: /google\.com\/maps|maps\.google|openstreetmap|mapbox/i.test(lower),
      ecommerce: /add to cart|checkout|shopify|woocommerce|basket|carrello/i.test(text + lower),
      structuredData: $('script[type="application/ld+json"]').length > 0,
    },
    socialLinks,
  };
}

export function deriveIssues(a: Omit<WebsiteAudit, "issues">, industry: string, now = new Date()): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (code: string, severity: AuditIssue["severity"], message: string) => issues.push({ code, severity, message });

  if (!a.url) {
    add("no_website", "high", "No website found in public listings.");
    return issues;
  }
  if (!a.reachable) {
    add("unreachable", "high", `Website did not load${a.httpStatus ? ` (HTTP ${a.httpStatus})` : ""}.`);
    return issues;
  }
  if (!a.https) add("no_https", "high", "Site is served without HTTPS; browsers flag it as 'Not secure'.");
  if (!a.hasViewportMeta) add("not_mobile", "high", "No mobile viewport tag; the page is likely not mobile-friendly.");
  if (!a.title) add("no_title", "medium", "Page has no <title>, which hurts search results.");
  if (!a.metaDescription) add("no_meta_description", "medium", "No meta description; search engines will pick arbitrary text.");
  if (a.h1Count === 0) add("no_h1", "low", "No main heading (H1) on the homepage.");
  if (a.imageCount > 0 && a.imagesMissingAlt / a.imageCount > 0.5)
    add("missing_alt", "low", `${a.imagesMissingAlt} of ${a.imageCount} images lack alt text (accessibility).`);
  if (a.responseMs && a.responseMs > 3000) add("slow", "medium", `Homepage took ${(a.responseMs / 1000).toFixed(1)}s to respond.`);
  if (a.htmlBytes > 1_500_000) add("heavy", "low", "Homepage HTML is unusually large.");
  if (a.copyrightYear && now.getFullYear() - a.copyrightYear >= 3)
    add("stale", "medium", `Footer copyright is ${a.copyrightYear}; the site looks unmaintained.`);
  if (!a.features.structuredData) add("no_structured_data", "low", "No structured data (schema.org) for rich search results.");

  const needsBooking = ["restaurant", "barber", "salon", "dental", "gym", "hotel"].includes(industry);
  if (needsBooking && !a.features.booking) add("no_booking", "medium", "No online booking or reservation option found.");
  if (["restaurant", "cafe", "bar"].includes(industry) && !a.features.menu) add("no_menu", "medium", "No menu found on the homepage.");
  if (industry === "clothing" && !a.features.ecommerce) add("no_shop", "medium", "No online shop found.");
  return issues;
}

export async function auditWebsite(rawUrl: string | undefined, industry: string): Promise<{ audit: WebsiteAudit; html: string | null }> {
  const auditedAt = new Date().toISOString();
  const empty = {
    https: false, hasViewportMeta: false, title: null, metaDescription: null, h1Count: 0, imageCount: 0,
    imagesMissingAlt: 0, htmlBytes: 0, copyrightYear: null, generator: null, socialLinks: {},
    features: { booking: false, menu: false, contactForm: false, map: false, ecommerce: false, structuredData: false },
  };
  if (!rawUrl) {
    const base = { ...empty, url: null, reachable: false, httpStatus: null, responseMs: null, robotsDisallowed: false, auditedAt };
    return { audit: { ...base, issues: deriveIssues(base, industry) }, html: null };
  }

  const url = normalizeUrl(rawUrl);
  if (await robotsDisallowsHome(url)) {
    const base = { ...empty, url, reachable: true, httpStatus: null, responseMs: null, robotsDisallowed: true, auditedAt };
    return { audit: { ...base, issues: [{ code: "robots_blocked", severity: "low", message: "robots.txt asks crawlers not to read this site; audit skipped." }] }, html: null };
  }

  try {
    const page = await fetchPage(url);
    const reachable = page.status < 400;
    const analyzed = analyzeHtml(page.html, page.finalUrl);
    const base = { ...analyzed, reachable, httpStatus: page.status, responseMs: page.ms, robotsDisallowed: false, auditedAt };
    return { audit: { ...base, issues: deriveIssues(base, industry) }, html: reachable ? page.html : null };
  } catch {
    const base = { ...empty, url, reachable: false, httpStatus: null, responseMs: null, robotsDisallowed: false, auditedAt };
    return { audit: { ...base, issues: deriveIssues(base, industry) }, html: null };
  }
}
