import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { config } from "../config.ts";
import { serveDir } from "./server.ts";

// Automated QA on every generated site, in a real browser, at phone and
// desktop sizes: JS errors, broken internal links/assets, horizontal
// overflow, heading structure, and an axe-core accessibility scan.
// External requests (fonts, maps) are blocked so results are deterministic.

export interface QaProblem {
  page: string;
  viewport: string;
  kind: "js_error" | "broken_link" | "broken_asset" | "overflow" | "structure" | "a11y";
  detail: string;
  blocking: boolean;
}

export interface QaReport {
  passed: boolean;
  problems: QaProblem[];
  screenshots: string[];
  checkedAt: string;
}

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1366, height: 900 },
];

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

async function checkPage(page: Page, baseUrl: string, siteDir: string, file: string, viewport: string, problems: QaProblem[]): Promise<void> {
  const add = (kind: QaProblem["kind"], detail: string, blocking = true): void => void problems.push({ page: file, viewport, kind, detail, blocking });

  const res = await page.goto(`${baseUrl}/${file}`, { waitUntil: "load" });
  if (!res || res.status() >= 400) return add("broken_link", `${file} returned HTTP ${res?.status()}`);
  // Let reveal animations settle so screenshots and axe see final state.
  await page.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in")));
  await page.waitForTimeout(700);

  const facts = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1: document.querySelectorAll("h1").length,
    title: document.title,
    lang: document.documentElement.lang,
    links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? ""),
    brokenImages: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !/^https?:/.test(i.getAttribute("src") ?? "")).map((i) => i.getAttribute("src")),
  }));

  if (facts.overflow > 2) add("overflow", `Page scrolls sideways by ${facts.overflow}px`);
  if (facts.h1 !== 1) add("structure", `Expected exactly one <h1>, found ${facts.h1}`);
  if (!facts.title) add("structure", "Missing <title>");
  if (!facts.lang) add("structure", "Missing lang attribute");
  for (const src of facts.brokenImages) add("broken_asset", `Image failed to load: ${src}`);

  for (const href of facts.links) {
    if (/^(https?:|mailto:|tel:|#)/.test(href)) continue;
    const target = href.split("#")[0]!;
    if (target && !existsSync(path.join(siteDir, target))) add("broken_link", `Link to missing page: ${href}`);
  }

  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error axe is injected at runtime
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] });
    return (r.violations as { id: string; impact: string; help: string; nodes: unknown[] }[]).map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length }));
  });
  for (const v of violations) add("a11y", `${v.id} (${v.impact}, ${v.count}x): ${v.help}`, v.impact === "critical" || v.impact === "serious");
}

export async function runQa(siteDir: string, pages: string[], outDir: string): Promise<QaReport> {
  mkdirSync(outDir, { recursive: true });
  const { server, url } = await serveDir(siteDir);
  const browser = await chromium.launch(config.chromiumPath ? { executablePath: config.chromiumPath } : {});
  const problems: QaProblem[] = [];
  const screenshots: string[] = [];
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.route("**/*", (route) => (route.request().url().startsWith(url) ? route.continue() : route.abort()));
      page.on("pageerror", (err) => problems.push({ page: page.url(), viewport: vp.name, kind: "js_error", detail: err.message, blocking: true }));
      page.on("response", (r) => {
        if (r.url().startsWith(url) && r.status() >= 400) problems.push({ page: page.url(), viewport: vp.name, kind: "broken_asset", detail: `${r.status()} ${r.url()}`, blocking: true });
      });
      for (const file of pages) {
        await checkPage(page, url, siteDir, file, vp.name, problems);
        if (file === "index.html") {
          const shot = path.join(outDir, `${vp.name}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          screenshots.push(shot);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return { passed: !problems.some((p) => p.blocking), problems, screenshots, checkedAt: new Date().toISOString() };
}
