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
  kind: "js_error" | "broken_link" | "broken_asset" | "overflow" | "structure" | "a11y" | "interaction" | "placeholder" | "weight";
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

async function checkPage(page: Page, baseUrl: string, siteDir: string, file: string, viewport: string, problems: QaProblem[], mode: "demo" | "production"): Promise<void> {
  const add = (kind: QaProblem["kind"], detail: string, blocking = true): void => void problems.push({ page: file, viewport, kind, detail, blocking });

  const res = await page.goto(`${baseUrl}/${file}`, { waitUntil: "load" });
  if (!res || res.status() >= 400) return add("broken_link", `${file} returned HTTP ${res?.status()}`);
  // Let reveal animations settle so screenshots and axe see final state.
  await page.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in")));
  await scrollThrough(page);

  const facts = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1: document.querySelectorAll("h1").length,
    title: document.title,
    lang: document.documentElement.lang,
    links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? ""),
    brokenImages: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !/^https?:/.test(i.getAttribute("src") ?? "")).map((i) => i.getAttribute("src")),
  }));

  // Weight of everything the page loaded from the site itself (after scrolling, so lazy images count).
  const bytes = await page.evaluate(() =>
    (performance.getEntriesByType("navigation").concat(performance.getEntriesByType("resource")) as PerformanceResourceTiming[])
      .filter((e) => e.name.startsWith(location.origin))
      .reduce((sum, e) => sum + e.encodedBodySize, 0),
  );
  const mb = (bytes / 1_048_576).toFixed(2);
  if (bytes > 3 * 1_048_576) add("weight", `Page loads ${mb} MB — too heavy for mobile data`);
  else if (bytes > 1.5 * 1_048_576) add("weight", `Page loads ${mb} MB — consider fewer/smaller photos`, false);

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

  if (mode === "production") {
    const placeholders = await page.locator("svg.art").count();
    if (placeholders) add("placeholder", `${placeholders} placeholder image(s) on a production page`);
  }

  if (file === "index.html") await checkInteractions(page, viewport, add, mode);

  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error axe is injected at runtime
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] });
    return (r.violations as { id: string; impact: string; help: string; nodes: unknown[] }[]).map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length }));
  });
  for (const v of violations) add("a11y", `${v.id} (${v.impact}, ${v.count}x): ${v.help}`, v.impact === "critical" || v.impact === "serious");
}

/** Scroll like a visitor so lazy images load (and get checked), then return to the top. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("load");
  await page.waitForTimeout(300);
}

/** Clicks through what visitors actually use: the mobile menu and the booking form. */
async function checkInteractions(page: Page, viewport: string, add: (kind: QaProblem["kind"], detail: string, blocking?: boolean) => void, mode: "demo" | "production"): Promise<void> {
  if (viewport === "mobile") {
    const toggle = page.locator(".menu-toggle");
    if (await toggle.isVisible()) {
      await toggle.click();
      if (!(await page.locator("nav.main").isVisible())) add("interaction", "Mobile menu does not open");
      await toggle.click();
    }
  }

  const form = page.locator("form[data-booking]");
  if (!(await form.count())) return;
  // Capture where the form tries to send the visitor instead of leaving the page.
  await page.evaluate(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = (u?: string | URL) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(u));
      return null;
    };
  });
  await form.locator('button[type="submit"]').click();
  if (await form.locator(".form-error").isHidden()) add("interaction", "Empty booking form submitted without showing an error");

  await form.locator('input[name="name"]').fill("QA Prueba");
  // Fill whatever else this form requires (booking forms need a date, quote forms a description).
  for (const input of await form.locator("[required]:not([name=name])").all()) {
    const type = await input.getAttribute("type");
    if (type === "checkbox") await input.check();
    else if (type === "date") await input.fill("2030-01-15");
    else await input.fill("QA 2030");
  }
  const channel = await form.getAttribute("data-channel");
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(150);
  if (await form.locator(".form-error").isVisible()) return add("interaction", "Valid booking form still shows an error");

  if (mode === "demo") {
    const preview = (await form.locator(".form-status pre").textContent()) ?? "";
    if (!preview.includes("QA Prueba") || !preview.includes("2030")) add("interaction", "Booking preview does not contain the entered details");
  } else if (channel === "instagram") {
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    if (!/^https:\/\/ig\.me\/m\/[A-Za-z0-9._]+$/.test(opened[0] ?? "")) add("interaction", `Booking did not open the Instagram chat (got: ${opened[0] || "nothing"})`);
    if (!((await form.locator(".form-status pre").textContent()) ?? "").includes("QA Prueba")) add("interaction", "Instagram booking does not show the message to paste");
  } else if (channel === "whatsapp") {
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    const url = opened[0] ?? "";
    if (!/^https:\/\/wa\.me\/\d{8,15}\?text=/.test(url) || !decodeURIComponent(url).includes("QA Prueba")) add("interaction", `Booking did not open WhatsApp with the request (got: ${url || "nothing"})`);
  }
}

export async function runQa(siteDir: string, pages: string[], outDir: string, mode: "demo" | "production" = "demo"): Promise<QaReport> {
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
        await checkPage(page, url, siteDir, file, vp.name, problems, mode);
        if (file === "index.html") {
          // Fresh load so the screenshot shows the page as a visitor first sees it, not mid-test.
          await page.goto(`${url}/index.html`, { waitUntil: "load" });
          await page.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in")));
          await scrollThrough(page);
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
