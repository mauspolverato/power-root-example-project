import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../config.ts";
import type { Business, DesignBrief } from "../types.ts";
import { onColor } from "./color.ts";
import { INDUSTRY_TEXT, localeFor } from "./i18n.ts";
import type { SiteImage } from "./images.ts";

// Most links to a Venezuelan small business get shared on WhatsApp, which
// shows the og:image as a big preview card. We render a branded 1200x630 card
// (and a 180x180 home-screen icon) in a headless browser at build time.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function renderShareImages(b: Business, brief: DesignBrief, images: SiteImage[], siteDir: string, logoFile?: string): Promise<{ shareImage: string; touchIcon: string }> {
  const p = brief.palette;
  const on = onColor(p.primary);
  const t = INDUSTRY_TEXT[localeFor(b)][b.industry];
  const photo = images[0] && !/^https?:/.test(images[0].src) ? `data:image/jpeg;base64,${readFileSync(path.join(siteDir, images[0].src)).toString("base64")}` : null;
  const logo = logoFile ? `data:image/${path.extname(logoFile).slice(1).replace("jpg", "jpeg").replace("svg", "svg+xml")};base64,${readFileSync(logoFile).toString("base64")}` : null;
  const fonts = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(brief.typography.heading).replace(/%20/g, "+")}:wght@600;700&display=block`;

  const card = `<!doctype html><html><head><link rel="stylesheet" href="${fonts}"><style>
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;display:grid;grid-template-columns:${photo ? "1.05fr .95fr" : "1fr"};background:${p.primary};color:${on};font-family:"${brief.typography.heading}",Georgia,serif;overflow:hidden}
.text{padding:72px;display:flex;flex-direction:column;justify-content:center;gap:28px;position:relative}
.text::after{content:"";position:absolute;left:72px;bottom:64px;width:96px;height:8px;background:${p.accent}}
.logo{max-height:110px;max-width:420px;object-fit:contain;align-self:flex-start;background:#fff;padding:14px 22px;border-radius:14px}
h1{font-size:${b.name.length > 24 ? 66 : 82}px;line-height:1.02;font-weight:700}
p{font:500 30px/1.3 system-ui,sans-serif;opacity:.88}
.photo{background:url("${photo}") center/cover}
</style></head><body><div class="text">${logo ? `<img class="logo" src="${logo}" alt="">` : ""}<h1>${esc(b.name)}</h1><p>${esc(t.label)}${b.city ? ` · ${esc(b.city)}` : ""}</p></div>${photo ? '<div class="photo"></div>' : ""}</body></html>`;

  const icon = `<!doctype html><html><head><link rel="stylesheet" href="${fonts}"><style>*{margin:0}body{width:180px;height:180px;display:grid;place-items:center;background:${p.primary};color:${on};font:700 112px/1 "${brief.typography.heading}",Georgia,serif}</style></head><body>${esc(b.name.trim().charAt(0).toUpperCase())}</body></html>`;

  const browser = await chromium.launch(config.chromiumPath ? { executablePath: config.chromiumPath } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    // Fonts are a nice-to-have: if Google Fonts is unreachable, don't hang the build.
    await page.route("https://fonts.**", (r) => r.continue().catch(() => r.abort()));
    await page.setContent(card, { waitUntil: "load", timeout: 15_000 }).catch(() => undefined);
    await page.screenshot({ path: path.join(siteDir, "og.png") });
    await page.setViewportSize({ width: 180, height: 180 });
    await page.setContent(icon, { waitUntil: "load", timeout: 15_000 }).catch(() => undefined);
    await page.screenshot({ path: path.join(siteDir, "apple-touch-icon.png") });
  } finally {
    await browser.close();
  }
  return { shareImage: "og.png", touchIcon: "apple-touch-icon.png" };
}
