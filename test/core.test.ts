import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeHtml, deriveIssues, parseRobotsDisallowsRoot } from "../src/audit/website.ts";
import { heuristicBrief, sanitizeBrief } from "../src/brand/analyze.ts";
import { extractBrandSignals, rankColors } from "../src/brand/extract.ts";
import { Store } from "../src/db.ts";
import { parseCsv } from "../src/discovery/csv.ts";
import { parseOsmElements } from "../src/discovery/osm.ts";
import { contrast } from "../src/generator/color.ts";
import { fallbackContent } from "../src/generator/content.ts";
import { formatOpeningHours } from "../src/generator/i18n.ts";
import { formatPhone, isLikelyWhatsApp, toE164 } from "../src/generator/phone.ts";
import { renderSite, resolveImages } from "../src/generator/render.ts";
import { friendly, quote } from "../src/pricing/engine.ts";
import { scoreLead } from "../src/scoring/score.ts";
import type { Business, WebsiteAudit } from "../src/types.ts";

const biz: Business = { id: 1, name: "Café <Test> & Co", industry: "restaurant", city: "Roma", country: "IT", phone: "06 1", socials: {}, photos: [], source: "test", sourceId: "1" };

const OLD_SITE = `<html><head><title>Old</title><style>.a{color:#9c2a1e}.b{background:#9c2a1e}.c{color:#3f6b35}.d{color:#ffffff}.e{color:#333}</style></head>
<body><img src="logo.png" class="logo"><p>Our menu</p><p>&copy; 2016 Old</p><a href="https://instagram.com/x">ig</a></body></html>`;

test("csv parser handles quotes, commas and newlines", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\n'), [["a", "b"], ["x, y", 'say "hi"']]);
});

test("OSM elements map to businesses with socials", () => {
  const [b] = parseOsmElements([{ type: "node", id: 5, lat: 1, lon: 2, tags: { name: "Bar X", "contact:instagram": "https://instagram.com/barx", "addr:street": "Via A", "addr:housenumber": "3" } }], "bar", "Roma");
  assert.equal(b!.sourceId, "node/5");
  assert.equal(b!.socials.instagram, "https://instagram.com/barx");
  assert.equal(b!.website, undefined);
  assert.match(b!.address!, /Via A 3/);
});

test("robots.txt parsing", () => {
  assert.equal(parseRobotsDisallowsRoot("User-agent: *\nDisallow: /", "Bot"), true);
  assert.equal(parseRobotsDisallowsRoot("User-agent: Google\nDisallow: /\n\nUser-agent: *\nDisallow: /admin", "Bot"), false);
  assert.equal(parseRobotsDisallowsRoot("User-agent: bot\nDisallow: /", "Bot"), true);
});

test("audit finds real issues on an old site", () => {
  const a = analyzeHtml(OLD_SITE, "http://old.example/");
  const full = { ...a, reachable: true, httpStatus: 200, responseMs: 300, robotsDisallowed: false, auditedAt: "" };
  const codes = deriveIssues(full, "restaurant", new Date("2026-01-01")).map((i) => i.code);
  for (const c of ["no_https", "not_mobile", "stale", "no_booking", "no_meta_description"]) assert.ok(codes.includes(c), c);
  assert.ok(!codes.includes("no_menu"));
  assert.equal(a.socialLinks.instagram, "https://instagram.com/x");
});

test("brand extraction ranks saturated colors and ignores neutrals", async () => {
  assert.deepEqual(rankColors(".a{color:#fff}.b{color:#9c2a1e}.c{color:#9C2A1E}.d{color:#3f6b35}"), ["#9c2a1e", "#3f6b35"]);
  const s = await extractBrandSignals(OLD_SITE, "http://old.example/", { fetchCss: false });
  assert.equal(s.colors[0], "#9c2a1e");
  assert.equal(s.logoUrl, "http://old.example/logo.png");
});

test("lead scoring: no website + contactable qualifies; uncontactable never does", () => {
  const audit = { url: null, reachable: false, issues: [{ code: "no_website", severity: "high", message: "" }], socialLinks: {}, robotsDisallowed: false } as unknown as WebsiteAudit;
  assert.equal(scoreLead(biz, audit).qualified, true);
  assert.equal(scoreLead({ ...biz, phone: undefined }, audit).score, 0);
});

test("briefs keep brand colors and always stay readable", () => {
  const brief = sanitizeBrief(heuristicBrief(biz, { colors: ["#ffee00"], fonts: [], logoUrl: null, tagline: null, textSample: "", imageUrls: [] }), "restaurant");
  assert.ok(contrast(brief.palette.primary, brief.palette.background) >= 4.5);
  assert.ok(contrast(brief.palette.text, brief.palette.background) >= 7);
  assert.equal(brief.layout.sectionOrder[0], "hero");
  assert.equal(brief.layout.sectionOrder.at(-1), "contact");
  const bad = sanitizeBrief({ ...brief, palette: { ...brief.palette, primary: "red" }, layout: { hero: "split", sectionOrder: ["contact", "nonsense", "about"] } }, "restaurant");
  assert.ok(bad.palette.primary.startsWith("#"));
  assert.ok(!bad.layout.sectionOrder.includes("nonsense" as never));
});

test("rendered demo escapes text, is noindex, and is labelled as a preview", () => {
  const brief = sanitizeBrief(heuristicBrief(biz, null), "restaurant");
  const site = renderSite({ business: biz, brief, content: fallbackContent(biz), agency: { name: "Studio", email: "a@b.c" }, isDemo: true });
  const html = site.files["index.html"]!;
  assert.ok(html.includes("Café &lt;Test&gt; &amp; Co"));
  assert.ok(!html.includes("<Test>"));
  assert.ok(html.includes('content="noindex'));
  assert.ok(html.includes("Not an official website"));
  assert.ok(html.includes('<html lang="en">'));
  assert.equal(site.files["robots.txt"], "User-agent: *\nDisallow: /\n");
  assert.ok(site.files["menu.html"]);
});

test("pricing produces friendly prices with positive margins", () => {
  assert.equal(friendly(587), 590);
  assert.equal(friendly(1213), 1190);
  assert.equal(friendly(52), 49);
  const q = quote(biz, null, 0.5);
  assert.equal(q.tier, "business");
  assert.ok(q.marginOneTime > 0 && q.marginMonthly > 0);
  assert.ok(q.hybrid.setup < q.oneTime.price);
});

test("suppression blocks emails and whole domains", () => {
  const s = new Store(":memory:");
  s.suppress("https://www.Example.com/contact", "asked");
  assert.equal(s.isSuppressed("http://example.com"), true);
  s.suppress("Owner@Shop.it", "opt-out");
  assert.equal(s.isSuppressed(undefined, "owner@shop.it"), true);
  assert.equal(s.isSuppressed("other@shop.it"), false);
});

const veBiz: Business = { id: 2, name: "Arepera Test", industry: "restaurant", city: "Caracas", country: "VE", phone: "0414-555.01.01", socials: { instagram: "@arepera" }, photos: [], source: "test", sourceId: "2" };

test("Venezuelan phones normalise to E.164 and mobiles are WhatsApp", () => {
  assert.equal(toE164("0414-555.01.01", "VE"), "584145550101");
  assert.equal(toE164("+58 241 555 0303", "VE"), "582415550303");
  assert.equal(isLikelyWhatsApp("584145550101", "VE"), true);
  assert.equal(isLikelyWhatsApp("582415550303", "VE"), false); // landline
  assert.equal(formatPhone("584145550101"), "+58 414 555 0101");
});

test("opening hours are humanised in Spanish", () => {
  assert.deepEqual(formatOpeningHours("Tu-Sa 09:00-19:00; Mo off", "es"), ["Mar–Sáb 09:00–19:00", "Lun Cerrado"]);
  assert.deepEqual(formatOpeningHours("24/7", "es"), ["Abierto las 24 horas"]);
});

test("Venezuelan site is in Spanish with WhatsApp booking; production has no placeholders", () => {
  const brief = sanitizeBrief(heuristicBrief(veBiz, null), "restaurant");
  const content = fallbackContent(veBiz);
  const demo = renderSite({ business: veBiz, brief, content, agency: { name: "Studio", email: "a@b.c" }, isDemo: true });
  const html = demo.files["index.html"]!;
  assert.ok(html.includes('<html lang="es">'));
  assert.ok(html.includes('data-wa="584145550101"'));
  assert.ok(html.includes('data-mode="demo"'));
  assert.ok(html.includes("https://wa.me/584145550101"));
  assert.ok(html.includes("https://instagram.com/arepera"));
  assert.ok(demo.files["menu.html"]);
  assert.ok(html.includes('class="art"')); // demo may show placeholders

  const prod = renderSite({ business: veBiz, brief, content, agency: { name: "Studio", email: "a@b.c" }, isDemo: false, siteUrl: "https://arepera.example" });
  const p = prod.files["index.html"]!;
  assert.ok(!p.includes('class="art"'));
  assert.ok(!p.includes("demo-bar"));
  assert.ok(p.includes('data-mode="live"'));
  assert.ok(p.includes('<link rel="canonical" href="https://arepera.example/">'));
  assert.ok(p.includes("application/ld+json"));
  assert.match(prod.files["sitemap.xml"]!, /https:\/\/arepera\.example\/menu\.html/);
  assert.ok(prod.files["404.html"]);
  assert.ok(!/aquí va tu foto|your photo here/i.test(Object.values(prod.files).join("")));
});

test("local photos are copied into the site", () => {
  const withPhotos = { ...veBiz, photos: ["fixtures/photos/arepera-1.jpg", "https://cdn.example/x.jpg", "missing.jpg"] };
  const { images, assets } = resolveImages(withPhotos);
  assert.deepEqual(images, ["img/photo-1.jpg", "https://cdn.example/x.jpg"]);
  assert.ok(assets["img/photo-1.jpg"]!.endsWith("fixtures/photos/arepera-1.jpg"));
});

test("Venezuelan quotes are in USD at local price level with positive margins", () => {
  const q = quote(veBiz, null);
  assert.equal(q.currency, "USD");
  assert.ok(q.oneTime.price < 600);
  assert.ok(q.marginOneTime > 0 && q.marginMonthly > 0, `${q.marginOneTime} ${q.marginMonthly}`);
  assert.ok(q.features.some((f) => f.includes("WhatsApp")));
});
