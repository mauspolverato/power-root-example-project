import * as cheerio from "cheerio";
import { config } from "../config.ts";
import type { BrandSignals } from "../types.ts";

// Pulls the visual identity a business already has out of its website HTML
// and stylesheets: dominant non-neutral colors, font families, logo, tagline.
// Deterministic and free — the AI step then interprets these signals.

const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const RGB = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;
const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "inherit", "initial", "-apple-system", "blinkmacsystemfont", "segoe ui", "arial", "helvetica", "helvetica neue", "roboto", "times new roman", "georgia", "verdana", "tahoma", "apple color emoji", "segoe ui emoji", "var"]);

export function expandHex(hex: string): string {
  const h = hex.replace("#", "").toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = expandHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Saturation (0-1) in HSL terms — near-grey colors are not brand colors. */
export function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

export function rankColors(css: string, max = 6): string[] {
  const counts = new Map<string, number>();
  const bump = (hex: string) => counts.set(hex, (counts.get(hex) ?? 0) + 1);
  for (const m of css.matchAll(HEX)) bump(expandHex(m[0]));
  for (const m of css.matchAll(RGB)) bump(rgbToHex(Number(m[1]), Number(m[2]), Number(m[3])));
  return [...counts.entries()]
    .filter(([hex]) => saturation(hex) > 0.18)
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, max);
}

export function rankFonts(css: string, html: string): string[] {
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    for (const f of m[1]!.split(",")) {
      const name = f.trim().replace(/^['"]|['"]$/g, "");
      if (name && !GENERIC_FONTS.has(name.toLowerCase()) && !name.startsWith("var(")) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  // Google Fonts links name the families explicitly and are a strong signal.
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)) {
    for (const fam of m[1]!.matchAll(/family=([^:&]+)/g)) {
      const name = decodeURIComponent(fam[1]!.replace(/\+/g, " "));
      counts.set(name, (counts.get(name) ?? 0) + 5);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 3);
}

async function fetchStylesheets(urls: string[]): Promise<string> {
  const sheets = await Promise.all(
    urls.slice(0, 3).map(async (u) => {
      try {
        const res = await fetch(u, { headers: { "user-agent": config.userAgent }, signal: AbortSignal.timeout(10_000) });
        return res.ok ? (await res.text()).slice(0, 500_000) : "";
      } catch {
        return "";
      }
    }),
  );
  return sheets.join("\n");
}

export async function extractBrandSignals(html: string, pageUrl: string, opts: { fetchCss?: boolean } = {}): Promise<BrandSignals> {
  const $ = cheerio.load(html);
  const abs = (u: string | undefined) => {
    if (!u) return null;
    try {
      return new URL(u, pageUrl).toString();
    } catch {
      return null;
    }
  };

  let css = $("style").text() + " " + $("[style]").map((_, el) => $(el).attr("style")).get().join(";");
  const themeColor = $('meta[name="theme-color"]').attr("content");
  if (themeColor) css += ` ${themeColor} ${themeColor} ${themeColor}`; // weight it: explicit brand color
  if (opts.fetchCss !== false) {
    const origin = new URL(pageUrl).origin;
    const sheetUrls = $('link[rel="stylesheet"]')
      .map((_, l) => abs($(l).attr("href")))
      .get()
      .filter((u): u is string => Boolean(u) && u.startsWith(origin));
    css += await fetchStylesheets(sheetUrls);
  }

  const logoEl = $("img")
    .filter((_, img) => /logo/i.test(`${$(img).attr("src")} ${$(img).attr("alt")} ${$(img).attr("class")} ${$(img).attr("id")}`))
    .first();
  const logoUrl =
    abs(logoEl.attr("src")) ??
    abs($('link[rel="apple-touch-icon"]').attr("href")) ??
    abs($('meta[property="og:image"]').attr("content"));

  const tagline =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $("h1, h2").first().text().replace(/\s+/g, " ").trim() ||
    null;

  $("script, style, noscript, svg").remove();
  const textSample = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);

  const imageUrls = $("img")
    .map((_, img) => abs($(img).attr("src")))
    .get()
    .filter((u): u is string => Boolean(u) && !/logo|icon|sprite|pixel|\.svg/i.test(u))
    .slice(0, 12);

  return { colors: rankColors(css), fonts: rankFonts(css, html), logoUrl, tagline, textSample, imageUrls };
}
