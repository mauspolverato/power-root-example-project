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
import { renderSite } from "../src/generator/render.ts";
import { friendly, quote } from "../src/pricing/engine.ts";
import { scoreLead } from "../src/scoring/score.ts";
import type { Business, WebsiteAudit } from "../src/types.ts";

const biz: Business = { id: 1, name: "Café <Test> & Co", industry: "restaurant", city: "Roma", country: "IT", phone: "06 1", socials: {}, source: "test", sourceId: "1" };

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
  const site = renderSite({ business: biz, brief, content: fallbackContent(biz, brief), agency: { name: "Studio", email: "a@b.c" }, isDemo: true });
  const html = site.files["index.html"]!;
  assert.ok(html.includes("Café &lt;Test&gt; &amp; Co"));
  assert.ok(!html.includes("<Test>"));
  assert.ok(html.includes('content="noindex'));
  assert.ok(html.includes("Not an official website"));
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
