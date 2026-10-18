import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Business, DesignBrief, SiteContent } from "../types.ts";
import { contrast, mix, onColor } from "./color.ts";
import { formatOpeningHours, INDUSTRY_TEXT, localeFor, UI, type Locale } from "./i18n.ts";
import { type SectionId, stableHash } from "./industries.ts";
import { formatPhone, isLikelyWhatsApp, toE164 } from "./phone.ts";

// Static-site renderer. Output is plain HTML + CSS + a few lines of JS: it
// loads fast, hosts anywhere for free (Cloudflare Pages, Netlify, S3) and is
// easy for a human to hand-edit. Individuality comes from the brief: palette,
// type, style system, hero layout and section order all vary.
//
// Two modes:
// - demo: private preview. Banner, noindex, placeholder art where photos are
//   missing, and forms show what they *would* send instead of sending.
// - production: the real site. Forms open WhatsApp (or email) with the request
//   pre-filled, no placeholders ever, plus SEO extras (sitemap, canonical, schema.org).

export interface RenderInput {
  business: Business;
  brief: DesignBrief;
  content: SiteContent;
  agency: { name: string; email: string };
  logoUrl?: string | null;
  /** Extra image URLs (e.g. from the business's current website), used after business.photos. */
  extraImages?: string[];
  isDemo: boolean;
  /** Public URL of the production site, e.g. https://arepera.com — enables canonical + sitemap. */
  siteUrl?: string;
}

export interface RenderedSite {
  files: Record<string, string>;
  /** Files to copy into the site: published path -> local source file. */
  assets: Record<string, string>;
  pages: string[];
}

const esc = (s: string | null | undefined): string =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STYLE_SYSTEMS: Record<DesignBrief["style"], { radius: string; headingWeight: number; headingCase: string; tracking: string; shadow: string; border: string; scale: number }> = {
  editorial: { radius: "2px", headingWeight: 500, headingCase: "none", tracking: "-0.01em", shadow: "none", border: "1px solid var(--line)", scale: 1.25 },
  bold: { radius: "0", headingWeight: 800, headingCase: "uppercase", tracking: "0.01em", shadow: "6px 6px 0 var(--accent)", border: "2px solid var(--text)", scale: 1.3 },
  minimal: { radius: "10px", headingWeight: 600, headingCase: "none", tracking: "-0.02em", shadow: "0 1px 2px rgb(0 0 0 / .06)", border: "1px solid var(--line)", scale: 1.15 },
  warm: { radius: "18px", headingWeight: 600, headingCase: "none", tracking: "-0.01em", shadow: "0 10px 30px -12px rgb(0 0 0 / .18)", border: "none", scale: 1.2 },
  luxury: { radius: "0", headingWeight: 400, headingCase: "none", tracking: "0.02em", shadow: "none", border: "1px solid var(--line)", scale: 1.25 },
  playful: { radius: "24px", headingWeight: 700, headingCase: "none", tracking: "-0.01em", shadow: "0 8px 0 -2px var(--secondary-strong)", border: "none", scale: 1.2 },
};

export function buildCss(brief: DesignBrief): string {
  const p = brief.palette;
  const s = STYLE_SYSTEMS[brief.style];
  const line = mix(p.text, p.background, 0.85);
  const muted = mix(p.text, p.background, 0.3);
  const secondaryStrong = mix(p.secondary, p.primary, 0.25);
  // Accent text must stay legible; fall back to primary when it isn't.
  const accentText = contrast(p.accent, p.background) >= 4.5 ? p.accent : p.primary;

  return `:root{--primary:${p.primary};--on-primary:${onColor(p.primary)};--secondary:${p.secondary};--secondary-strong:${secondaryStrong};--accent:${p.accent};--on-accent:${onColor(p.accent)};--accent-text:${accentText};--bg:${p.background};--text:${p.text};--muted:${muted};--line:${line};--radius:${s.radius};--shadow:${s.shadow};--card-border:${s.border};--font-heading:"${brief.typography.heading}",Georgia,serif;--font-body:"${brief.typography.body}",system-ui,sans-serif;--h1:clamp(2.4rem,${(4.2 * s.scale).toFixed(2)}vw,${(4.6 * s.scale).toFixed(2)}rem);--h2:clamp(1.8rem,${(2.6 * s.scale).toFixed(2)}vw,${(2.8 * s.scale).toFixed(2)}rem)}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:1.0625rem;line-height:1.65}
img{max-width:100%;display:block;height:auto}
a{color:var(--primary)}
nav.main a[aria-current="page"]{color:var(--primary);text-decoration:underline;text-underline-offset:.3em}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
h1,h2,h3{font-family:var(--font-heading);font-weight:${s.headingWeight};text-transform:${s.headingCase};letter-spacing:${s.tracking};line-height:1.1;margin:0 0 .5em;overflow-wrap:break-word}
h1{font-size:var(--h1)}h2{font-size:var(--h2)}h3{font-size:1.25rem}
p{margin:0 0 1em}
.wrap{width:min(1160px,100% - 2.5rem);margin-inline:auto}
.skip{position:absolute;left:-999px;top:0;background:var(--primary);color:var(--on-primary);padding:.6rem 1rem;z-index:100}.skip:focus{left:1rem}
.demo-bar{background:#111;color:#fff;font:500 .82rem/1.4 system-ui,sans-serif;padding:.55rem 1rem;text-align:center}
.demo-bar a{color:#fff}
header.site{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:4.25rem}
.brand{display:flex;align-items:center;gap:.6rem;font-family:var(--font-heading);font-weight:${s.headingWeight};font-size:1.3rem;text-decoration:none;color:var(--text);text-transform:${s.headingCase}}
.brand img{height:2.4rem;width:auto}
nav.main ul{display:flex;gap:1.4rem;list-style:none;margin:0;padding:0}
nav.main a{color:var(--text);text-decoration:none;font-weight:500;font-size:.95rem}
nav.main a:hover{color:var(--primary)}
.menu-toggle{display:none;background:none;border:var(--card-border);border-color:var(--line);border-radius:var(--radius);padding:.45rem .7rem;font:inherit;color:var(--text)}
@media (max-width:820px){.menu-toggle{display:block}nav.main{display:none;position:absolute;inset:100% 0 auto;background:var(--bg);border-bottom:1px solid var(--line)}nav.main.open{display:block}nav.main ul{flex-direction:column;gap:0;padding:.5rem 1.25rem 1rem}nav.main a{display:block;padding:.7rem 0}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.85rem 1.4rem;min-height:44px;border-radius:var(--radius);background:var(--primary);color:var(--on-primary);text-decoration:none;font-weight:600;border:0;cursor:pointer;font-size:1rem;font-family:inherit;transition:transform .15s ease}
.btn:hover{transform:translateY(-1px)}
.btn.ghost{background:transparent;color:var(--text);box-shadow:inset 0 0 0 2px currentColor}
.btn.accent{background:var(--accent);color:var(--on-accent)}
section{padding:clamp(3.5rem,8vw,6.5rem) 0}
section.tint{background:var(--secondary)}
.eyebrow{display:inline-block;font-size:.78rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-text);margin-bottom:.8rem}
.lead{font-size:1.2rem;color:var(--muted);max-width:38rem}
.hero{padding:clamp(3rem,8vw,7rem) 0}
.hero .actions{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:1.6rem}
.hero-split .wrap{display:grid;grid-template-columns:1.1fr 1fr;gap:clamp(2rem,5vw,4.5rem);align-items:center}
.hero-centered{text-align:center}.hero-centered .lead{margin-inline:auto}.hero-centered .actions{justify-content:center}.hero-centered .media{margin-top:3rem}
.hero-fullbleed{position:relative;color:#fff;min-height:min(86vh,760px);display:flex;align-items:flex-end;padding-bottom:clamp(3rem,7vw,5.5rem);isolation:isolate}
.hero-fullbleed .media{position:absolute;inset:0;z-index:-1}.hero-fullbleed .media>*{width:100%;height:100%;object-fit:cover;border-radius:0}
.hero-fullbleed::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(0 0 0 / .05) 20%,rgb(0 0 0 / .72))}
.hero-fullbleed .lead{color:rgb(255 255 255 / .88)}.hero-fullbleed .btn.ghost{color:#fff}
@media (max-width:820px){.hero-split .wrap{grid-template-columns:1fr}}
.media>img,.media>svg,.media .art{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius);box-shadow:var(--shadow)}
.grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:1.5rem}
.card{background:var(--bg);border:var(--card-border);border-radius:var(--radius);box-shadow:var(--shadow);padding:1.6rem}
section.tint .card{background:color-mix(in srgb,var(--bg) 85%,var(--secondary))}
.num{font-family:var(--font-heading);font-size:2.4rem;color:var(--accent-text);line-height:1;margin-bottom:.6rem;display:block}
.about-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:clamp(2rem,6vw,5rem);align-items:center}
@media (max-width:820px){.about-grid{grid-template-columns:1fr}}
.menu-list{list-style:none;margin:0;padding:0;max-width:46rem}
.menu-list li{padding:1.1rem 0;border-bottom:1px solid var(--line)}
.menu-list .row{display:flex;align-items:baseline;gap:.75rem}
.menu-list .row h3{margin:0;font-size:1.2rem}
.menu-list .dots{flex:1;border-bottom:2px dotted var(--line);transform:translateY(-.3rem)}
.menu-list .price{font-weight:700;color:var(--primary)}
.menu-list p{margin:.3rem 0 0;color:var(--muted)}
.gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem}
.gallery-5>*:first-child{grid-column:span 2;grid-row:span 2}
.gallery-3{grid-template-columns:repeat(3,1fr)}
.gallery-4{grid-template-columns:repeat(2,1fr)}
.gallery.gallery-4 img,.gallery.gallery-4 svg{aspect-ratio:3/2}
.gallery img,.gallery svg{width:100%;height:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius)}
@media (max-width:640px){.gallery,.gallery-4{grid-template-columns:repeat(2,1fr)}.gallery-3>*:first-child,.gallery-5>*:first-child{grid-column:span 2}}
form.request{display:grid;gap:1rem;max-width:40rem}
form.request .two{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
@media (max-width:560px){form.request .two{grid-template-columns:1fr}}
label{display:grid;gap:.35rem;font-weight:600;font-size:.92rem}
input,textarea,select{font:inherit;padding:.75rem .9rem;min-height:44px;border:1px solid color-mix(in srgb,var(--text) 35%,var(--bg));border-radius:min(var(--radius),10px);background:var(--bg);color:var(--text)}
.consent{display:flex;gap:.6rem;align-items:flex-start;font-weight:400}.consent input{min-height:auto;margin-top:.35rem}
.hero-centered .media>*{aspect-ratio:21/9}
@media (max-width:640px){.hero-centered .media>*{aspect-ratio:4/3}}
.form-note{font-size:.85rem;color:var(--muted)}
.form-status{font-weight:600;color:var(--primary)}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(2rem,5vw,4rem)}
@media (max-width:820px){.info-grid{grid-template-columns:1fr}}
.hours{list-style:none;padding:0;margin:0}.hours li{padding:.45rem 0;border-bottom:1px solid var(--line)}
.map-box{border-radius:var(--radius);overflow:hidden;border:1px solid var(--line);background:var(--secondary);min-height:280px;display:grid;place-items:center;text-align:center;padding:1.5rem}
.map-box iframe{width:100%;height:340px;border:0}
details{border-bottom:1px solid var(--line);padding:1rem 0}
summary{cursor:pointer;font-weight:600;font-size:1.08rem}
details p{margin:.7rem 0 0;color:var(--muted)}
.contact-cta{background:var(--primary);color:var(--on-primary);border-radius:var(--radius);padding:clamp(2rem,5vw,3.5rem);display:grid;gap:1rem}
.contact-cta a{color:var(--on-primary)}
.contact-cta .btn{background:var(--on-primary);color:var(--primary);justify-self:start}
footer.site{padding:2.5rem 0;border-top:1px solid var(--line);font-size:.9rem;color:var(--muted)}
footer.site .wrap{display:flex;flex-wrap:wrap;gap:1rem 2rem;justify-content:space-between}
footer.site a{color:var(--muted)}
.reveal{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s ease}.reveal.in{opacity:1;transform:none}
.prose{max-width:46rem}.prose h2{font-size:1.5rem;margin-top:2rem}
.hero-plain{padding:clamp(4rem,12vw,9rem) 0;background:radial-gradient(120% 90% at 85% 0%,var(--secondary) 0%,transparent 60%),var(--bg)}
.hero-plain{position:relative;overflow:hidden}
.hero-plain h1{max-width:18ch}
.hero-plain[data-initial]::after{content:attr(data-initial);position:absolute;right:max(1rem,calc((100vw - 1160px)/2));top:50%;transform:translateY(-50%);font-family:var(--font-heading);font-weight:${s.headingWeight};font-size:clamp(12rem,30vw,26rem);line-height:1;color:var(--secondary-strong);opacity:.55;pointer-events:none;z-index:0}
.hero-plain .wrap{position:relative;z-index:1}
@media (max-width:820px){.hero-plain[data-initial]::after{display:none}}
.more{margin-top:1.5rem}
.btn.wa{background:#0b7a43;color:#fff}
.btn.wa svg{flex:none}
.contact-cta .btn.wa{background:#fff;color:#0b7a43}
.wa-float{position:fixed;right:1rem;bottom:1rem;z-index:60;width:56px;height:56px;border-radius:50%;background:#0b7a43;color:#fff;display:grid;place-items:center;box-shadow:0 8px 24px -6px rgb(0 0 0 / .35);transition:transform .15s ease}
.wa-float:hover{transform:scale(1.06)}
.wa-float svg{width:28px;height:28px}
footer.site{padding-bottom:5.5rem}
[aria-invalid="true"]{border-color:#b42318;box-shadow:0 0 0 2px #fcd9d6}
.form-error{color:#b42318;font-weight:600;margin:0}
.form-status pre{white-space:pre-wrap;background:var(--secondary);border-radius:min(var(--radius),10px);padding:1rem;font:inherit;font-size:.95rem;margin:.5rem 0 0}
`;
}

/** Abstract placeholder artwork in the brand palette — clearly a placeholder, never a fake photo. */
export function placeholderArt(brief: DesignBrief, seed: number, label: string): string {
  const p = brief.palette;
  const angle = 20 + (seed % 140);
  const from = mix(p.secondary, p.primary, 0.18);
  const to = mix(p.secondary, p.accent, 0.35);
  const id = `g${seed.toString(36)}`;
  return `<svg class="art" viewBox="0 0 400 300" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient><pattern id="${id}l" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><line x1="0" y1="0" x2="0" y2="14" stroke="${p.background}" stroke-opacity=".18" stroke-width="1"/></pattern></defs><rect width="400" height="300" fill="url(#${id})"/><rect width="400" height="300" fill="url(#${id}l)"/><rect x="${200 - label.length * 3.1 - 14}" y="262" width="${label.length * 6.2 + 28}" height="24" rx="12" fill="${p.background}" fill-opacity=".85"/><text x="200" y="278" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="${p.text}">${esc(label)}</text></svg>`;
}


interface Ctx {
  input: RenderInput;
  locale: Locale;
  ui: (typeof UI)[Locale];
  text: (typeof INDUSTRY_TEXT)[Locale][Business["industry"]];
  images: string[];
  whatsapp: string | null; // E.164 digits
  tel: string | null; // E.164 digits for tel: links
}

const WA_ICON = `<svg aria-hidden="true" viewBox="0 0 32 32" width="22" height="22" fill="currentColor"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.7c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7Zm5.9-8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.7 3.7 0 0 0-1.1 2.7 6.4 6.4 0 0 0 1.3 3.4 14.7 14.7 0 0 0 5.6 5c2.1.9 2.9 1 4 .8.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.3.2-1.5l-.6-.3Z"/></svg>`;

function image(ctx: Ctx, index: number, label: string): string {
  const src = ctx.images[index];
  if (src) return `<img src="${esc(src)}" alt="${esc(label)}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async">`;
  // Production sites never show placeholders; the layout adapts instead.
  if (!ctx.input.isDemo) return "";
  return placeholderArt(ctx.input.brief, stableHash(`${ctx.input.business.name}${index}`), ctx.ui.photoPlaceholder(label));
}

function hoursList(ctx: Ctx): string {
  const raw = ctx.input.business.openingHours;
  if (!raw) return `<p class="form-note">${esc(ctx.ui.hoursTbd)}</p>`;
  return `<ul class="hours">${formatOpeningHours(raw, ctx.locale).map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`;
}

const isFoodIndustry = (b: Business) => ["restaurant", "cafe", "bar"].includes(b.industry);

/** Food businesses get a menu with dotted price leaders; everyone else gets cards. */
function offerList(ctx: Ctx, limit: number): string {
  const items = ctx.input.content.services.slice(0, limit);
  return isFoodIndustry(ctx.input.business)
    ? `<ul class="menu-list">${items.map((s) => `<li><div class="row"><h3>${esc(s.name)}</h3>${s.price ? `<span class="dots"></span><span class="price">${esc(s.price)}</span>` : ""}</div><p>${esc(s.description)}</p></li>`).join("")}</ul>`
    : `<div class="grid-3">${items.map((s) => `<div class="card reveal"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p>${s.price ? `<p><strong>${esc(s.price)}</strong></p>` : ""}</div>`).join("")}</div>`;
}

function waLink(number: string, message?: string): string {
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** Where the main call-to-action should go, best channel first. */
function primaryHref(ctx: Ctx, order: SectionId[]): string {
  if (ctx.text.bookingLabel && order.includes("booking") && (ctx.whatsapp || ctx.input.business.email)) return "#booking";
  if (ctx.whatsapp) return waLink(ctx.whatsapp);
  if (ctx.tel) return `tel:+${ctx.tel}`;
  return "#contact";
}

function section(id: SectionId, ctx: Ctx, order: SectionId[]): string {
  const { business: b, content: c, brief } = ctx.input;
  const { ui, text: t } = ctx;
  const isFood = isFoodIndustry(b);

  switch (id) {
    case "hero": {
      const media = image(ctx, 0, b.name);
      const hero = media ? brief.layout.hero : "plain";
      const actions = `<div class="actions"><a class="btn${hero === "fullbleed" ? " accent" : ""}" href="${primaryHref(ctx, order)}">${esc(c.primaryCta)}</a><a class="btn ghost" href="${t.offerPage}.html">${esc(t.offerLabel)}</a></div>`;
      const copy = `<div><span class="eyebrow">${esc(t.label)}${b.city ? ` · ${esc(b.city)}` : ""}</span><h1>${esc(c.heroHeadline)}</h1><p class="lead">${esc(c.heroSubheadline)}</p>${actions}</div>`;
      const mediaBox = `<div class="media">${media}</div>`;
      if (hero === "split") return `<section class="hero hero-split"><div class="wrap">${copy}${mediaBox}</div></section>`;
      if (hero === "fullbleed") return `<section class="hero hero-fullbleed">${mediaBox}<div class="wrap">${copy}</div></section>`;
      if (hero === "plain") return `<section class="hero hero-plain" data-initial="${esc(b.name.trim().charAt(0).toUpperCase())}"><div class="wrap">${copy}</div></section>`;
      return `<section class="hero hero-centered"><div class="wrap">${copy}${mediaBox}</div></section>`;
    }
    case "about": {
      const media = image(ctx, 1, ui.inside(b.name));
      const copy = `<div><span class="eyebrow">${esc(ui.about)}</span><h2>${esc(b.name)}</h2>${c.about.split(/\n+/).map((para) => `<p>${esc(para)}</p>`).join("")}</div>`;
      return `<section id="about"><div class="wrap ${media ? "about-grid" : "prose"} reveal">${media ? `<div class="media">${media}</div>` : ""}${copy}</div></section>`;
    }
    case "highlights": {
      const numbered = brief.style === "editorial" || brief.style === "luxury";
      return `<section class="tint"><div class="wrap"><div class="grid-3">${c.highlights
        .slice(0, 3)
        .map((h, i) => `<div class="card reveal">${numbered ? `<span class="num">0${i + 1}</span>` : ""}<h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>`)
        .join("")}</div></div></section>`;
    }
    case "offer":
      return `<section id="offer"><div class="wrap"><span class="eyebrow">${esc(t.offerLabel)}</span><h2>${esc(t.offerLabel)}</h2>${offerList(ctx, 6)}<p class="more"><a href="${t.offerPage}.html">${esc(ui.seeFull(t.offerLabel))}</a></p></div></section>`;
    case "gallery": {
      const tiles = [2, 3, 4, 5, 6].map((i) => image(ctx, i, ui.photo(b.name, i - 1))).filter(Boolean);
      if (tiles.length < 3) return ""; // a half-empty gallery looks worse than none
      return `<section class="tint" aria-label="${esc(ui.gallery)}"><div class="wrap"><div class="gallery gallery-${tiles.length} reveal">${tiles.join("")}</div></div></section>`;
    }
    case "booking": {
      if (!t.bookingLabel || (!ctx.whatsapp && !b.email)) return "";
      const channel = ctx.whatsapp ? "whatsapp" : "email";
      const attrs = [
        `data-booking`,
        `data-mode="${ctx.input.isDemo ? "demo" : "live"}"`,
        `data-channel="${channel}"`,
        ctx.whatsapp ? `data-wa="${ctx.whatsapp}"` : "",
        b.email ? `data-email="${esc(b.email)}"` : "",
        `data-intro="${esc(ui.bookingMessage(b.name, ""))}"`,
        `data-subject="${esc(t.bookingLabel)} — ${esc(b.name)}"`,
        `data-msg-demo="${esc(channel === "whatsapp" ? ui.formResult.demo : ui.formResult.demoMessage)}"`,
        `data-msg-live="${esc(channel === "whatsapp" ? ui.formResult.opened : ui.formResult.mailFallback)}"`,
      ].filter(Boolean).join(" ");
      const f = ui.form;
      return `<section id="booking"><div class="wrap"><span class="eyebrow">${esc(t.bookingLabel)}</span><h2>${esc(t.bookingLabel)}</h2>
<form class="request" ${attrs} novalidate>
<div class="two"><label>${esc(f.name)} *<input name="name" autocomplete="name" required data-label="${esc(f.name)}"></label><label>${esc(f.contact)}<input name="contact" autocomplete="tel" data-label="${esc(f.contact)}"></label></div>
<div class="two"><label>${esc(f.date)} *<input type="date" name="date" required data-label="${esc(f.date)}"></label><label>${esc(f.time)}<input type="time" name="time" data-label="${esc(f.time)}"></label></div>
<label>${esc(t.bookingDetailLabel)}<input name="detail" ${isFood || b.industry === "hotel" ? 'inputmode="numeric"' : ""} data-label="${esc(t.bookingDetailLabel)}"></label>
<label>${esc(f.message)}<textarea name="message" rows="3" data-label="${esc(f.message)}"></textarea></label>
<label class="consent"><input type="checkbox" name="consent" required> <span>${esc(f.consent)} <a href="privacy.html">${esc(f.privacyLink)}</a>.</span></label>
<button class="btn${channel === "whatsapp" ? " wa" : ""}" type="submit">${channel === "whatsapp" ? `${WA_ICON} ${esc(f.sendWhatsApp)}` : esc(f.send)}</button>
<p class="form-note">${esc(f.confirmedBy(b.name))}${ctx.tel ? ` — ${esc(f.orCall)} <a href="tel:+${ctx.tel}">${esc(formatPhone(ctx.tel))}</a>` : ""}.</p>
<p class="form-error" role="alert" hidden>${esc(f.required)}</p>
<div class="form-status" role="status" aria-live="polite"></div>
</form></div></section>`;
    }
    case "hours_location": {
      const mapLinks =
        b.lat && b.lon
          ? `<a href="https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lon}#map=17/${b.lat}/${b.lon}">${esc(ui.openMap)}</a> · <a href="https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lon}">Google Maps</a>`
          : b.address
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name}, ${b.address}`)}">${esc(ui.findOnMap)}</a>`
            : "";
      const embedUrl =
        b.lat && b.lon
          ? `https://www.openstreetmap.org/export/embed.html?bbox=${b.lon - 0.004},${b.lat - 0.0025},${b.lon + 0.004},${b.lat + 0.0025}&marker=${b.lat},${b.lon}`
          : b.address
            ? `https://maps.google.com/maps?q=${encodeURIComponent(`${b.name}, ${b.address}`)}&output=embed`
            : null;
      const embed = embedUrl ? `<button class="btn ghost" type="button" data-load-map="${esc(embedUrl)}">${esc(ui.showMap)}</button><p class="form-note">${esc(b.lat && b.lon ? ui.mapNote : ui.mapNoteGoogle)}</p>` : "";
      return `<section id="visit" class="tint"><div class="wrap info-grid"><div><span class="eyebrow">${esc(ui.visit)}</span><h2>${esc(ui.hours)}</h2>${hoursList(ctx)}</div><div><h2>${esc(ui.findUs)}</h2>${b.address ? `<p>${esc(b.address)}</p>` : ""}<div class="map-box" data-map-box>${embed || `<p>${mapLinks || esc(ui.addressTbd)}</p>`}</div>${embed && mapLinks ? `<p class="more">${mapLinks}</p>` : ""}</div></div></section>`;
    }
    case "faq":
      if (!c.faq.length) return "";
      return `<section><div class="wrap prose"><span class="eyebrow">${esc(ui.faq)}</span><h2>${esc(ui.faqTitle)}</h2>${c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div></section>`;
    case "contact": {
      const lines = [
        ctx.whatsapp ? `<p><a class="btn wa" href="${waLink(ctx.whatsapp)}">${WA_ICON} ${esc(ui.writeWhatsApp)}</a></p>` : "",
        ctx.tel ? `<p>${esc(ui.call)} <a href="tel:+${ctx.tel}">${esc(formatPhone(ctx.tel))}</a></p>` : "",
        b.email ? `<p>${esc(ui.email)} <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></p>` : "",
        b.address ? `<p>${esc(b.address)}</p>` : "",
        ...Object.entries(b.socials).map(([k, v]) => `<p><a href="${esc(socialUrl(k, v))}" rel="noopener">${esc(k.charAt(0).toUpperCase() + k.slice(1))}</a></p>`),
      ].join("");
      return `<section id="contact"><div class="wrap"><div class="contact-cta reveal"><h2>${esc(ui.contactTitle)}</h2>${lines}</div></div></section>`;
    }
  }
}

/** Accepts "https://instagram.com/x", "instagram.com/x" or "@x". */
export function socialUrl(network: string, value: string): string {
  if (/^https?:\/\//.test(value)) return value;
  if (/\.(com|net)\//.test(value)) return `https://${value}`;
  const handle = value.replace(/^@/, "");
  const hosts: Record<string, string> = { instagram: "https://instagram.com/", facebook: "https://facebook.com/", tiktok: "https://tiktok.com/@", twitter: "https://x.com/" };
  return (hosts[network] ?? "https://") + handle;
}

function jsonLd(ctx: Ctx): string {
  const { business: b, content: c, siteUrl } = ctx.input;
  const types: Record<string, string> = { restaurant: "Restaurant", cafe: "CafeOrCoffeeShop", bar: "BarOrPub", hotel: "Hotel", barber: "HairSalon", salon: "BeautySalon", gym: "ExerciseGym", clothing: "ClothingStore", dental: "Dentist", real_estate: "RealEstateAgent", other: "LocalBusiness" };
  const data: Record<string, unknown> = { "@context": "https://schema.org", "@type": types[b.industry], name: b.name, description: c.seoDescription };
  if (siteUrl) data.url = siteUrl;
  if (b.address) data.address = b.address;
  if (ctx.tel) data.telephone = `+${ctx.tel}`;
  if (b.lat && b.lon) data.geo = { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lon };
  if (b.openingHours && /^[A-Z][a-z][-,A-Za-z\s\d:;]*$/.test(b.openingHours)) data.openingHours = b.openingHours.split(/;\s*/);
  const sameAs = Object.entries(b.socials).map(([k, v]) => socialUrl(k, v));
  if (sameAs.length) data.sameAs = sameAs;
  if (ctx.images[0] && siteUrl) data.image = new URL(ctx.images[0], `${siteUrl}/`).toString();
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

// Booking: builds a readable message from the form and opens WhatsApp (or the
// mail app). In demo mode it shows the message instead of sending anything.
const SCRIPT = `(()=>{const t=document.querySelector('.menu-toggle'),n=document.querySelector('nav.main');
t?.addEventListener('click',()=>{const o=n.classList.toggle('open');t.setAttribute('aria-expanded',o)});
n?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');t?.setAttribute('aria-expanded','false')}));
document.querySelectorAll('form[data-booking]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();
const err=f.querySelector('.form-error'),st=f.querySelector('.form-status'),bad=[...f.querySelectorAll('[required]')].filter(i=>i.type==='checkbox'?!i.checked:!i.value.trim());
f.querySelectorAll('[aria-invalid]').forEach(i=>i.removeAttribute('aria-invalid'));bad.forEach(i=>i.setAttribute('aria-invalid','true'));
if(bad.length){err.hidden=false;bad[0].focus();return}err.hidden=true;
const lines=[...f.querySelectorAll('[data-label]')].filter(i=>i.value.trim()).map(i=>'• '+i.dataset.label+': '+(i.type==='date'?new Date(i.value+'T12:00').toLocaleDateString(document.documentElement.lang,{weekday:'long',day:'numeric',month:'long',year:'numeric'}):i.value.trim()));
const msg=f.dataset.intro+lines.join('\\n'),d=f.dataset;
if(d.mode==='demo'){st.replaceChildren(Object.assign(document.createElement('p'),{textContent:d.msgDemo}),Object.assign(document.createElement('pre'),{textContent:msg}));return}
const url=d.channel==='whatsapp'?'https://wa.me/'+d.wa+'?text='+encodeURIComponent(msg):'mailto:'+d.email+'?subject='+encodeURIComponent(d.subject)+'&body='+encodeURIComponent(msg);
if(d.channel==='whatsapp')window.open(url,'_blank','noopener');else location.href=url;st.textContent=d.msgLive}));
document.querySelectorAll('[data-load-map]').forEach(b=>b.addEventListener('click',()=>{const i=document.createElement('iframe');i.src=b.dataset.loadMap;i.title='Mapa';i.loading='lazy';b.closest('[data-map-box]').replaceChildren(i)}));
const r=document.querySelectorAll('.reveal');if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.12});r.forEach(el=>io.observe(el))}else r.forEach(el=>el.classList.add('in'))})();`;

function favicon(brief: DesignBrief, name: string): string {
  const letter = esc(name.trim().charAt(0).toUpperCase() || "•");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${brief.palette.primary}"/><text x="32" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="36" font-weight="700" fill="${onColor(brief.palette.primary)}">${letter}</text></svg>`;
}

function page(ctx: Ctx, opts: { path: string; title: string; description: string; body: string; nav: { href: string; label: string }[] }): string {
  const { business: b, brief, agency, isDemo, siteUrl } = ctx.input;
  const { ui } = ctx;
  const fonts = [...new Set([brief.typography.heading, brief.typography.body])]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  const removeHref = `mailto:${agency.email}?subject=${encodeURIComponent(`Eliminar vista previa / Remove preview: ${b.name}`)}`;
  const banner = isDemo ? `<div class="demo-bar" role="note">${ui.demoBanner(esc(agency.name), esc(b.name), esc(removeHref))}</div>` : "";
  const canonical = siteUrl && !isDemo ? `${siteUrl}/${opts.path === "index.html" ? "" : opts.path}` : null;
  const ogImage = siteUrl && ctx.images[0] ? new URL(ctx.images[0], `${siteUrl}/`).toString() : null;
  return `<!doctype html>
<html lang="${ctx.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
${isDemo ? '<meta name="robots" content="noindex, nofollow, noarchive">' : ""}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${ctx.locale === "es" ? `es_${(b.country ?? "VE").toUpperCase()}` : "en_US"}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
<meta name="theme-color" content="${brief.palette.primary}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<link rel="stylesheet" href="styles.css">
${isDemo || opts.path !== "index.html" ? "" : jsonLd(ctx)}
</head>
<body>
<a class="skip" href="#main">${esc(ui.skip)}</a>
${banner}
<header class="site"><div class="wrap"><a class="brand" href="index.html">${ctx.input.logoUrl ? `<img src="${esc(ctx.input.logoUrl)}" alt="" height="40" onerror="this.remove()">` : ""}<span>${esc(b.name)}</span></a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav">${esc(ui.nav.menuToggle)}</button>
<nav class="main" id="nav" aria-label="${esc(ui.nav.menuToggle)}"><ul>${opts.nav.map((n) => `<li><a href="${n.href}"${n.href === opts.path ? ' aria-current="page"' : ""}>${esc(n.label)}</a></li>`).join("")}</ul></nav></div></header>
<main id="main">
${opts.body}
</main>
<footer class="site"><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(b.name)}</span><span>${b.address ? esc(b.address) : ""}</span><a href="privacy.html">${esc(ui.privacy)}</a></div></footer>
${ctx.whatsapp ? `<a class="wa-float" href="${waLink(ctx.whatsapp)}" aria-label="${esc(ui.whatsappFloat)}" title="${esc(ui.whatsappFloat)}">${WA_ICON}</a>` : ""}
<script>${SCRIPT}</script>
</body>
</html>`;
}

/** Local photo files are copied into img/; URLs are used as-is. */
export function resolveImages(b: Business, extra: string[] = []): { images: string[]; assets: Record<string, string> } {
  const images: string[] = [];
  const assets: Record<string, string> = {};
  b.photos.forEach((p, i) => {
    if (/^https?:\/\//.test(p)) images.push(p);
    else if (existsSync(p)) {
      const dest = `img/photo-${i + 1}${path.extname(p).toLowerCase() || ".jpg"}`;
      assets[dest] = path.resolve(p);
      images.push(dest);
    }
  });
  return { images: [...images, ...extra], assets };
}

export function renderSite(input: RenderInput): RenderedSite {
  const { business: b, brief, content: c } = input;
  const locale = localeFor(b);
  const ui = UI[locale];
  const text = INDUSTRY_TEXT[locale][b.industry];
  const tel = toE164(b.phone, b.country);
  const waCandidate = b.whatsapp ? toE164(b.whatsapp, b.country) : tel;
  const whatsapp = b.whatsapp ? waCandidate : isLikelyWhatsApp(tel, b.country) ? tel : null;
  const { images, assets } = resolveImages(b, input.extraImages);
  const ctx: Ctx = { input, locale, ui, text, images, whatsapp, tel };

  const order = brief.layout.sectionOrder as SectionId[];
  const hasBooking = Boolean(text.bookingLabel && order.includes("booking") && (whatsapp || b.email));
  const nav = [
    { href: `${text.offerPage}.html`, label: text.offerLabel },
    ...(order.includes("about") ? [{ href: "index.html#about", label: ui.nav.about }] : []),
    ...(order.includes("hours_location") ? [{ href: "index.html#visit", label: ui.nav.visit }] : []),
    ...(hasBooking ? [{ href: "index.html#booking", label: ui.nav.book }] : []),
    { href: "index.html#contact", label: ui.nav.contact },
  ];

  const pages: Record<string, string> = {};
  pages["index.html"] = page(ctx, { path: "index.html", title: c.seoTitle, description: c.seoDescription, nav, body: order.map((s) => section(s, ctx, order)).join("\n") });
  pages[`${text.offerPage}.html`] = page(ctx, {
    path: `${text.offerPage}.html`,
    title: `${text.offerLabel} — ${b.name}`,
    description: `${text.offerLabel} — ${b.name}${b.city ? `, ${b.city}` : ""}.`,
    nav,
    body: `<section><div class="wrap"><span class="eyebrow">${esc(b.name)}</span><h1>${esc(text.offerLabel)}</h1>${offerList(ctx, 50)}</div></section>${section("contact", ctx, order)}`,
  });
  pages["privacy.html"] = page(ctx, {
    path: "privacy.html",
    title: `${ui.privacy} — ${b.name}`,
    description: `${ui.privacy} — ${b.name}.`,
    nav,
    body: `<section><div class="wrap prose">${ui.privacyPage(esc(b.name), b.address ? esc(b.address) : undefined, b.email ? esc(b.email) : undefined)}</div></section>`,
  });
  const notFound = page(ctx, {
    path: "404.html",
    title: `${ui.notFoundTitle} — ${b.name}`,
    description: ui.notFoundText,
    nav,
    body: `<section class="hero hero-plain"><div class="wrap"><h1>${esc(ui.notFoundTitle)}</h1><p class="lead">${esc(ui.notFoundText)}</p><div class="actions"><a class="btn" href="index.html">${esc(ui.backHome)}</a></div></div></section>`,
  });

  const files: Record<string, string> = { ...pages, "404.html": notFound, "styles.css": buildCss(brief), "favicon.svg": favicon(brief, b.name) };
  if (input.isDemo) files["robots.txt"] = "User-agent: *\nDisallow: /\n";
  else {
    files["robots.txt"] = `User-agent: *\nAllow: /\n${input.siteUrl ? `Sitemap: ${input.siteUrl}/sitemap.xml\n` : ""}`;
    if (input.siteUrl) {
      const today = new Date().toISOString().slice(0, 10);
      files["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(pages)
        .map((p) => `  <url><loc>${input.siteUrl}/${p === "index.html" ? "" : p}</loc><lastmod>${today}</lastmod></url>`)
        .join("\n")}\n</urlset>\n`;
    }
  }
  return { files, assets, pages: Object.keys(pages) };
}

export function writeSite(site: RenderedSite, dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(site.files)) writeFileSync(path.join(dir, name), body);
  for (const [dest, src] of Object.entries(site.assets)) {
    mkdirSync(path.dirname(path.join(dir, dest)), { recursive: true });
    copyFileSync(src, path.join(dir, dest));
  }
}
