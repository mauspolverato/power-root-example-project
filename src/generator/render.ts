import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Business, DesignBrief, SiteContent } from "../types.ts";
import { contrast, mix, onColor } from "./color.ts";
import { INDUSTRY_PROFILES, type SectionId, stableHash } from "./industries.ts";

// Static-site renderer. Output is plain HTML + CSS + a few lines of JS: it
// loads fast, hosts anywhere for free (Cloudflare Pages, Netlify, S3) and is
// easy for a human to hand-edit before a sale. Individuality comes from the
// brief: palette, type, style system, hero layout and section order all vary.

export interface RenderInput {
  business: Business;
  brief: DesignBrief;
  content: SiteContent;
  agency: { name: string; email: string };
  logoUrl?: string | null;
  imageUrls?: string[]; // only the business's own public images, and only for the private demo
  isDemo: boolean;
}

export interface RenderedSite {
  files: Record<string, string>;
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
.gallery>*:first-child{grid-column:span 2;grid-row:span 2}
.gallery img,.gallery svg{width:100%;height:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius)}
@media (max-width:640px){.gallery{grid-template-columns:repeat(2,1fr)}}
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

function image(input: RenderInput, index: number, label: string): string {
  const url = input.imageUrls?.[index];
  if (url) return `<img src="${esc(url)}" alt="${esc(label)}" loading="${index === 0 ? "eager" : "lazy"}">`;
  return placeholderArt(input.brief, stableHash(`${input.business.name}${index}`), `${label} — your photo here`);
}

function hoursList(openingHours: string | undefined): string {
  if (!openingHours) return `<p class="form-note">Opening hours to be confirmed with you.</p>`;
  const parts = openingHours.split(/;\s*/).filter(Boolean);
  return `<ul class="hours">${parts.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`;
}

const isFoodIndustry = (b: Business) => ["restaurant", "cafe", "bar"].includes(b.industry);

/** Food businesses get a menu with dotted price leaders; everyone else gets cards. */
function offerList(input: RenderInput, limit: number): string {
  const items = input.content.services.slice(0, limit);
  return isFoodIndustry(input.business)
    ? `<ul class="menu-list">${items.map((s) => `<li><div class="row"><h3>${esc(s.name)}</h3>${s.price ? `<span class="dots"></span><span class="price">${esc(s.price)}</span>` : ""}</div><p>${esc(s.description)}</p></li>`).join("")}</ul>`
    : `<div class="grid-3">${items.map((s) => `<div class="card reveal"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p>${s.price ? `<p><strong>${esc(s.price)}</strong></p>` : ""}</div>`).join("")}</div>`;
}

function section(id: SectionId, input: RenderInput): string {
  const { business: b, content: c, brief } = input;
  const profile = INDUSTRY_PROFILES[b.industry];
  const isFood = isFoodIndustry(b);

  switch (id) {
    case "hero": {
      const hero = brief.layout.hero;
      const actions = `<div class="actions"><a class="btn${hero === "fullbleed" ? " accent" : ""}" href="${profile.bookingLabel ? "#booking" : "#contact"}">${esc(c.primaryCta)}</a><a class="btn ghost" href="${profile.offerPage}.html">${esc(profile.offerLabel)}</a></div>`;
      const text = `<div><span class="eyebrow">${esc(profile.label)}${b.city ? ` · ${esc(b.city)}` : ""}</span><h1>${esc(c.heroHeadline)}</h1><p class="lead">${esc(c.heroSubheadline)}</p>${actions}</div>`;
      const media = `<div class="media">${image(input, 0, `${b.name}`)}</div>`;
      if (hero === "split") return `<section class="hero hero-split"><div class="wrap">${text}${media}</div></section>`;
      if (hero === "fullbleed") return `<section class="hero hero-fullbleed">${media}<div class="wrap">${text}</div></section>`;
      return `<section class="hero hero-centered"><div class="wrap">${text}${media}</div></section>`;
    }
    case "about":
      return `<section id="about"><div class="wrap about-grid reveal"><div class="media">${image(input, 1, `Inside ${b.name}`)}</div><div><span class="eyebrow">About</span><h2>${esc(b.name)}</h2>${c.about.split(/\n+/).map((para) => `<p>${esc(para)}</p>`).join("")}</div></div></section>`;
    case "highlights": {
      const numbered = brief.style === "editorial" || brief.style === "luxury";
      return `<section class="tint"><div class="wrap"><div class="grid-3">${c.highlights
        .slice(0, 3)
        .map((h, i) => `<div class="card reveal">${numbered ? `<span class="num">0${i + 1}</span>` : ""}<h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>`)
        .join("")}</div></div></section>`;
    }
    case "offer":
      return `<section id="offer"><div class="wrap"><span class="eyebrow">${esc(profile.offerLabel)}</span><h2>${esc(profile.offerLabel)}</h2>${offerList(input, 6)}<p style="margin-top:1.5rem"><a href="${profile.offerPage}.html">See the full ${esc(profile.offerLabel.toLowerCase())} →</a></p></div></section>`;
    case "gallery":
      return `<section class="tint" aria-label="Gallery"><div class="wrap"><div class="gallery reveal">${[2, 3, 4, 5, 6].map((i) => image(input, i, `${b.name} photo ${i - 1}`)).join("")}</div></div></section>`;
    case "booking":
      if (!profile.bookingLabel) return "";
      return `<section id="booking"><div class="wrap"><span class="eyebrow">${esc(profile.bookingLabel)}</span><h2>${esc(profile.bookingLabel)}</h2>
<form class="request" data-demo-form>
<div class="two"><label>Name<input name="name" autocomplete="name" required></label><label>Phone or email<input name="contact" required></label></div>
<div class="two"><label>Date<input type="date" name="date" required></label><label>${isFood || b.industry === "hotel" ? "Guests" : "Service"}<input name="detail"></label></div>
<label>Message<textarea name="message" rows="3"></textarea></label>
<label class="consent"><input type="checkbox" required> <span>I agree to my details being used to answer this request, as described in the <a href="privacy.html">privacy notice</a>.</span></label>
<button class="btn" type="submit">Send request</button>
<p class="form-note">Requests are confirmed by ${esc(b.name)}${b.phone ? ` — or call <a href="tel:${esc(b.phone.replace(/\s/g, ""))}">${esc(b.phone)}</a>` : ""}.</p>
<p class="form-status" role="status" aria-live="polite"></p>
</form></div></section>`;
    case "hours_location": {
      const mapLinks =
        b.lat && b.lon
          ? `<a href="https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lon}#map=17/${b.lat}/${b.lon}">Open map</a>`
          : b.address
            ? `<a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(b.address)}">Find on map</a>`
            : "";
      const embed =
        b.lat && b.lon
          ? `<button class="btn ghost" type="button" data-load-map="https://www.openstreetmap.org/export/embed.html?bbox=${b.lon - 0.004},${b.lat - 0.0025},${b.lon + 0.004},${b.lat + 0.0025}&marker=${b.lat},${b.lon}">Show interactive map</button><p class="form-note">Loads a map from OpenStreetMap.</p>`
          : "";
      return `<section id="visit" class="tint"><div class="wrap info-grid"><div><span class="eyebrow">Visit</span><h2>Opening hours</h2>${hoursList(b.openingHours)}</div><div><h2>Find us</h2>${b.address ? `<p>${esc(b.address)}</p>` : ""}<div class="map-box" data-map-box>${embed || `<p>${mapLinks || "Address to be confirmed."}</p>`}</div>${embed && mapLinks ? `<p style="margin-top:.8rem">${mapLinks}</p>` : ""}</div></div></section>`;
    }
    case "faq":
      if (!c.faq.length) return "";
      return `<section><div class="wrap prose"><span class="eyebrow">FAQ</span><h2>Good to know</h2>${c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div></section>`;
    case "contact":
      return `<section id="contact"><div class="wrap"><div class="contact-cta reveal"><h2>Get in touch</h2>${b.phone ? `<p>Call <a href="tel:${esc(b.phone.replace(/\s/g, ""))}">${esc(b.phone)}</a></p>` : ""}${b.email ? `<p>Email <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></p>` : ""}${b.address ? `<p>${esc(b.address)}</p>` : ""}<a class="btn" href="${profile.bookingLabel ? "#booking" : b.phone ? `tel:${esc(b.phone.replace(/\s/g, ""))}` : "#visit"}">${esc(c.primaryCta)}</a></div></div></section>`;
  }
}

function jsonLd(b: Business, c: SiteContent): string {
  const types: Record<string, string> = { restaurant: "Restaurant", cafe: "CafeOrCoffeeShop", bar: "BarOrPub", hotel: "Hotel", barber: "HairSalon", salon: "BeautySalon", gym: "ExerciseGym", clothing: "ClothingStore", dental: "Dentist", real_estate: "RealEstateAgent", other: "LocalBusiness" };
  const data: Record<string, unknown> = { "@context": "https://schema.org", "@type": types[b.industry], name: b.name, description: c.seoDescription };
  if (b.address) data.address = b.address;
  if (b.phone) data.telephone = b.phone;
  if (b.lat && b.lon) data.geo = { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lon };
  if (b.openingHours && /^[A-Z][a-z][-,A-Za-z\s\d:;]*$/.test(b.openingHours)) data.openingHours = b.openingHours.split(/;\s*/);
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

const SCRIPT = `document.querySelector('.menu-toggle')?.addEventListener('click',e=>{const n=document.querySelector('nav.main');const o=n.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o)});
document.querySelectorAll('[data-demo-form]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();f.querySelector('.form-status').textContent=f.dataset.live?'Thank you — we will be in touch.':'Preview only: this form is not connected yet, so nothing was sent.'}));
document.querySelectorAll('[data-load-map]').forEach(b=>b.addEventListener('click',()=>{const i=document.createElement('iframe');i.src=b.dataset.loadMap;i.title='Map';i.loading='lazy';b.closest('[data-map-box]').replaceChildren(i)}));
if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>io.observe(el))}else document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));`;

function page(input: RenderInput, opts: { title: string; description: string; body: string; nav: { href: string; label: string }[] }): string {
  const { business: b, brief, agency, isDemo, content: c } = input;
  const fonts = [...new Set([brief.typography.heading, brief.typography.body])]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  const banner = isDemo
    ? `<div class="demo-bar" role="note">Concept preview prepared by ${esc(agency.name)} for ${esc(b.name)}. Not an official website and not affiliated with or approved by ${esc(b.name)}. Forms are not connected. <a href="mailto:${esc(agency.email)}?subject=${encodeURIComponent(`Remove preview: ${b.name}`)}">Ask us to remove it</a>.</div>`
    : "";
  return `<!doctype html>
<html lang="${esc(langFor(b))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
${isDemo ? '<meta name="robots" content="noindex, nofollow, noarchive">' : ""}
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="${brief.palette.primary}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<link rel="stylesheet" href="styles.css">
${isDemo ? "" : jsonLd(b, c)}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${banner}
<header class="site"><div class="wrap"><a class="brand" href="index.html">${input.logoUrl ? `<img src="${esc(input.logoUrl)}" alt="" height="40" onerror="this.remove()">` : ""}<span>${esc(b.name)}</span></a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
<nav class="main" id="nav" aria-label="Main"><ul>${opts.nav.map((n) => `<li><a href="${n.href}">${esc(n.label)}</a></li>`).join("")}</ul></nav></div></header>
<main id="main">
${opts.body}
</main>
<footer class="site"><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(b.name)}</span><span>${b.address ? esc(b.address) : ""}</span><a href="privacy.html">Privacy</a></div></footer>
<script>${SCRIPT}</script>
</body>
</html>`;
}

export function langFor(b: Business): string {
  const byCountry: Record<string, string> = { IT: "it", DE: "de", AT: "de", FR: "fr", ES: "es", PT: "pt", NL: "nl", GB: "en", US: "en", IE: "en" };
  return (b.country && byCountry[b.country.toUpperCase()]) || "en";
}

export function renderSite(input: RenderInput): RenderedSite {
  const { business: b, brief, content: c } = input;
  const profile = INDUSTRY_PROFILES[b.industry];
  const order = brief.layout.sectionOrder as SectionId[];
  const nav = [
    { href: `${profile.offerPage}.html`, label: profile.offerLabel },
    ...(order.includes("about") ? [{ href: "index.html#about", label: "About" }] : []),
    ...(order.includes("hours_location") ? [{ href: "index.html#visit", label: "Visit" }] : []),
    ...(profile.bookingLabel && order.includes("booking") ? [{ href: "index.html#booking", label: profile.bookingLabel.split(" ")[0]! }] : []),
    { href: "index.html#contact", label: "Contact" },
  ];

  const home = page(input, { title: c.seoTitle, description: c.seoDescription, nav, body: order.map((s) => section(s, input)).join("\n") });

  const offerBody = `<section><div class="wrap"><span class="eyebrow">${esc(b.name)}</span><h1>${esc(profile.offerLabel)}</h1>${offerList(input, 50)}</div></section>${section("contact", input)}`;
  const offer = page(input, { title: `${profile.offerLabel} — ${b.name}`, description: `${profile.offerLabel} at ${b.name}.`, nav, body: offerBody });

  const privacy = page(input, {
    title: `Privacy notice — ${b.name}`,
    description: `How ${b.name} handles personal data.`,
    nav,
    body: `<section><div class="wrap prose"><h1>Privacy notice</h1>
<p><strong>Template — to be completed and reviewed with ${esc(b.name)} before going live.</strong></p>
<h2>Who we are</h2><p>${esc(b.name)}${b.address ? `, ${esc(b.address)}` : ""} is the controller of personal data collected through this website.</p>
<h2>What we collect and why</h2><p>When you send a request through a form we collect the details you enter (name, contact details, message) to answer you. Legal basis: steps prior to a contract / your consent.</p>
<h2>How long we keep it</h2><p>Requests are deleted when no longer needed to answer you, and in any case within 12 months, unless a law requires longer.</p>
<h2>Third parties</h2><p>Fonts are loaded from Google Fonts; the optional map is loaded from OpenStreetMap only when you choose to show it. The site sets no tracking cookies.</p>
<h2>Your rights</h2><p>You can ask for access, correction, deletion or restriction of your data, object to processing, and complain to your data protection authority.${b.email ? ` Contact: <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>.` : ""}</p>
</div></section>`,
  });

  return {
    files: { "index.html": home, [`${profile.offerPage}.html`]: offer, "privacy.html": privacy, "styles.css": buildCss(brief), "robots.txt": input.isDemo ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n" },
    pages: ["index.html", `${profile.offerPage}.html`, "privacy.html"],
  };
}

export function writeSite(site: RenderedSite, dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(site.files)) writeFileSync(path.join(dir, name), body);
}
