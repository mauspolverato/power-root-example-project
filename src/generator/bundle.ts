import { readFileSync } from "node:fs";
import path from "node:path";
import type { RenderedSite } from "./render.ts";

// Turns a rendered site into ONE self-contained HTML file (CSS, logo and
// photos inlined) that opens straight from WhatsApp, email or a phone's files
// app. Used for sending drafts; the real site stays multi-page.

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };

const dataUri = (file: string) => `data:${MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream"};base64,${readFileSync(file).toString("base64")}`;

/** `siteDir` is where the site's img/ files were written. */
export function bundleSinglePage(site: RenderedSite, siteDir: string, offerPage: string): string {
  let html = site.files["index.html"]!;
  html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>${site.files["styles.css"]}</style>`);
  html = html.replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', () => `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(site.files["favicon.svg"]!)}">`);
  html = html.replace(/<link rel="apple-touch-icon"[^>]*>/, "");
  // One mid-size WebP per photo keeps the file small and sharp enough on phones.
  html = html.replace(/<picture><source[^>]*><img src="(img\/[^"]+)\.jpg"/g, (_, base: string) => `<picture><img src="${dataUri(path.join(siteDir, `${base}-800.webp`))}"`);
  html = html.replace(/src="(img\/[^"]+)"/g, (_, src: string) => `src="${dataUri(path.join(siteDir, src))}"`);
  // Other pages don't exist in a single file: point links at sections of this page.
  html = html
    .replace(/<p class="more"><a href="[^"]+\.html">.*?<\/a><\/p>/g, "")
    .replaceAll(`href="${offerPage}.html"`, 'href="#offer"')
    .replaceAll('href="index.html#', 'href="#')
    .replaceAll('href="index.html"', 'href="#main"')
    .replaceAll('href="privacy.html"', 'href="#contact"');
  return html;
}
