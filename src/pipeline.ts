import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { auditWebsite } from "./audit/website.ts";
import { buildBrief, heuristicBrief, sanitizeBrief } from "./brand/analyze.ts";
import { extractBrandSignals } from "./brand/extract.ts";
import { config } from "./config.ts";
import type { Store } from "./db.ts";
import { writeContent } from "./generator/content.ts";
import { bundleSinglePage } from "./generator/bundle.ts";
import { INDUSTRY_TEXT, localeFor } from "./generator/i18n.ts";
import { processPhotos } from "./generator/images.ts";
import { renderSite, writeSite } from "./generator/render.ts";
import { renderShareImages } from "./generator/share.ts";
import { quote } from "./pricing/engine.ts";
import { analysisReport, clientProposal } from "./proposal/proposal.ts";
import { type QaReport, runQa } from "./qa/check.ts";
import { scoreLead } from "./scoring/score.ts";
import { type BrandSignals, type Business, DesignBrief, SiteContent, type WebsiteAudit } from "./types.ts";

// Phase 1 pipeline for one business:
// audit -> score -> (if qualified) brief -> copy -> render -> QA (one auto-retry) -> price -> reports.
// Each step stores its result, so a failed run can be inspected and resumed.

export interface RunOptions {
  useSiteImages?: boolean; // use the business's own public photos in the private demo
  skipQa?: boolean;
  force?: boolean; // generate even if the lead is not qualified
}

export function slugify(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "business";
}

export async function processBusiness(store: Store, b: Business, opts: RunOptions = {}): Promise<{ stage: string; previewDir?: string }> {
  if (store.isSuppressed(b.email, b.website)) {
    store.setStage(b.id, "suppressed");
    return { stage: "suppressed" };
  }

  // 1. Audit the current website (or record that there is none).
  const { audit, html } = await auditWebsite(b.website, b.industry);
  store.setArtifact(b.id, "audit", audit);
  let signals: BrandSignals | null = null;
  if (html && audit.url) {
    signals = await extractBrandSignals(html, audit.url);
    store.setArtifact(b.id, "signals", signals);
  }
  store.setStage(b.id, "audited");

  // 2. Score.
  const score = scoreLead(b, audit);
  store.setArtifact(b.id, "score", score);
  if (!score.qualified && !opts.force) {
    store.setStage(b.id, "disqualified");
    return { stage: "disqualified" };
  }
  store.setStage(b.id, "qualified");

  // 3. Brand analysis + copy.
  const { brief, source: briefSource } = await buildBrief({ store, business: b, audit, signals });
  store.setArtifact(b.id, "brief", { ...brief, source: briefSource });
  const { content, source: contentSource } = await writeContent({ store, business: b, brief, signals });
  store.setArtifact(b.id, "content", { ...content, source: contentSource });
  store.setStage(b.id, "analyzed");

  // 4. Render into an unguessable directory: the demo URL is private by obscurity + noindex.
  const existing = store.getArtifact<{ dir: string; token: string }>(b.id, "demo");
  const token = existing?.token ?? randomBytes(6).toString("base64url");
  const dirName = `${slugify(b.name)}-${token}`;
  const previewDir = path.join(config.outputDir, "demos", dirName);
  const reportDir = path.join(config.outputDir, "reports", dirName);
  const images = await processPhotos(b.photos, previewDir);
  const logoUrl = placeLogo(b, previewDir) ?? signals?.logoUrl;
  const render = (br: DesignBrief) =>
    renderSite({
      business: b,
      brief: br,
      content,
      agency: config.agency,
      logoUrl,
      images,
      extraImages: opts.useSiteImages ? signals?.imageUrls : undefined,
      isDemo: true,
    });

  let site = render(brief);
  writeSite(site, previewDir);
  store.setArtifact(b.id, "demo", { dir: previewDir, token });
  store.setStage(b.id, "generated");

  // 5. QA, with one automatic repair attempt using the conservative fallback design.
  let qa: QaReport | null = null;
  if (!opts.skipQa) {
    qa = await runQa(previewDir, site.pages, path.join(reportDir, "qa"));
    if (!qa.passed) {
      store.log(b.id, "qa", `failed: ${qa.problems.filter((p) => p.blocking).map((p) => p.detail).join("; ")}`);
      const fallback = sanitizeBrief(heuristicBrief(b, signals), b.industry);
      site = render(fallback);
      writeSite(site, previewDir);
      const retry = await runQa(previewDir, site.pages, path.join(reportDir, "qa"));
      if (retry.passed) {
        store.setArtifact(b.id, "brief", { ...fallback, source: "heuristic (QA repair)" });
        store.log(b.id, "qa", "repaired by re-rendering with fallback design");
      }
      qa = retry;
    }
    store.setArtifact(b.id, "qa", qa);
    store.setStage(b.id, qa.passed ? "qa_passed" : "qa_failed");
  }

  // 6. Price + documents for human review.
  const aiCost = store.aiSpend(b.id);
  const q = quote(b, audit, aiCost);
  store.setArtifact(b.id, "quote", q);
  const previewUrl = `${config.previewBaseUrl}/${dirName}/`;
  const finalBrief = store.getArtifact<DesignBrief & { source: string }>(b.id, "brief")!;
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(path.join(reportDir, "analysis.md"), analysisReport({ business: b, audit, score, brief: finalBrief, briefSource: finalBrief.source, contentSource, qa, quote: q, previewUrl, aiCostUsd: aiCost }));
  writeFileSync(path.join(reportDir, "proposal.md"), clientProposal({ business: b, audit, brief: finalBrief, quote: q, previewUrl, agency: config.agency }));
  store.setStage(b.id, qa && !qa.passed ? "qa_failed" : "ready_for_review");
  return { stage: store.getStage(b.id)!, previewDir };
}

export function summarize(store: Store, b: Business): string {
  const score = store.getArtifact<{ score: number; qualified: boolean }>(b.id, "score");
  const audit = store.getArtifact<WebsiteAudit>(b.id, "audit");
  return `#${b.id} ${b.name} [${b.industry}] stage=${store.getStage(b.id)} score=${score?.score ?? "-"} site=${audit ? audit.url ?? "none" : b.website ?? "?"}`;
}

/** Copies the business's own logo file into the site; returns its site-relative path. */
function placeLogo(b: Business, dir: string): string | null {
  if (!b.logo) return null;
  if (/^https?:\/\//.test(b.logo)) return b.logo;
  if (!existsSync(b.logo)) return null;
  const dest = `img/logo${path.extname(b.logo).toLowerCase()}`;
  mkdirSync(path.join(dir, "img"), { recursive: true });
  copyFileSync(b.logo, path.join(dir, dest));
  return dest;
}

/** Path of the hand-editable copy for a business (created by `agency edit <id>`). */
export function editsPath(b: Business): string {
  return path.join(config.dataDir, "edits", `${b.id}-${slugify(b.name)}.json`);
}

/** Writes the current generated copy + design to a JSON file you can edit by hand before building. */
export function exportEdits(store: Store, b: Business): string {
  const file = editsPath(b);
  if (!existsSync(file)) {
    const content = store.getArtifact<SiteContent>(b.id, "content");
    const brief = store.getArtifact<DesignBrief>(b.id, "brief");
    if (!content || !brief) throw new Error("Run the pipeline for this business first (agency run --id N)");
    mkdirSync(path.dirname(file), { recursive: true });
    const { source: _c, ...cleanContent } = content as SiteContent & { source?: string };
    const { source: _b, ...cleanBrief } = brief as DesignBrief & { source?: string };
    writeFileSync(file, JSON.stringify({ content: cleanContent, brief: cleanBrief }, null, 2));
  }
  return file;
}

/**
 * Builds the real, publishable site from the stored (or hand-edited) brief and
 * copy: no banner, no placeholders, live WhatsApp/email booking, SEO files.
 */
/** Stored copy + design for a business, overridden by a hand-edited file when present. */
function loadSiteSpec(store: Store, b: Business, contentFile?: string): { content: SiteContent; brief: DesignBrief; genericCopy: boolean } {
  let content = store.getArtifact<SiteContent>(b.id, "content");
  let brief = store.getArtifact<DesignBrief>(b.id, "brief");
  const file = contentFile ?? editsPath(b);
  if (contentFile && !existsSync(file)) throw new Error(`Content file not found: ${file}`);
  if (existsSync(file)) {
    const edited = JSON.parse(readFileSync(file, "utf8")) as { content: unknown; brief: unknown };
    content = SiteContent.parse(edited.content);
    brief = DesignBrief.parse(edited.brief);
  }
  if (!content || !brief) throw new Error("Run the pipeline for this business first (agency run --id N)");
  const genericCopy = !existsSync(file) && (content as SiteContent & { source?: string }).source !== "ai";
  return { content, brief, genericCopy };
}

/**
 * A draft to send for feedback: demo mode (preview banner, photo placeholders)
 * bundled into ONE html file that opens from WhatsApp or a phone's files app.
 */
export async function buildDraft(store: Store, b: Business, opts: { contentFile?: string; out?: string } = {}): Promise<{ file: string; qa: QaReport }> {
  const { content, brief } = loadSiteSpec(store, b, opts.contentFile);
  const signals = store.getArtifact<BrandSignals>(b.id, "signals");
  const work = mkdtempSync(path.join(tmpdir(), "draft-"));
  const finalBrief = sanitizeBrief(brief, b.industry);
  const images = await processPhotos(b.photos, work);
  const logoUrl = placeLogo(b, work) ?? signals?.logoUrl;
  const site = renderSite({ business: b, brief: finalBrief, content, agency: config.agency, logoUrl, images, isDemo: true });
  const html = bundleSinglePage(site, work, INDUSTRY_TEXT[localeFor(b)][b.industry].offerPage);

  // QA the bundled file exactly as it will be opened.
  const qaDir = path.join(work, "qa-site");
  mkdirSync(qaDir, { recursive: true });
  writeFileSync(path.join(qaDir, "index.html"), html);
  const qa = await runQa(qaDir, ["index.html"], path.join(config.outputDir, "reports", `${slugify(b.name)}-draft`), "demo");

  const file = opts.out ?? path.join(config.outputDir, "drafts", `${slugify(b.name)}.html`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
  store.log(b.id, "draft", `single-file draft at ${file} (QA ${qa.passed ? "passed" : "FAILED"})`);
  return { file, qa };
}

export async function buildProduction(store: Store, b: Business, opts: { siteUrl?: string; skipQa?: boolean; contentFile?: string } = {}): Promise<{ dir: string; qa: QaReport | null; genericCopy: boolean }> {
  const { content, brief, genericCopy } = loadSiteSpec(store, b, opts.contentFile);
  const signals = store.getArtifact<BrandSignals>(b.id, "signals");

  const siteUrl = opts.siteUrl?.replace(/\/$/, "");
  if (siteUrl && !/^https:\/\//.test(siteUrl)) throw new Error("--domain must be a full https:// URL, e.g. https://arepera.com");
  const dir = path.join(config.outputDir, "sites", slugify(b.name));
  rmSync(dir, { recursive: true, force: true });
  const finalBrief = sanitizeBrief(brief, b.industry);
  const images = await processPhotos(b.photos, dir);
  const logoUrl = placeLogo(b, dir) ?? signals?.logoUrl;
  const share = await renderShareImages(b, finalBrief, images, dir, b.logo && existsSync(b.logo) ? b.logo : undefined);
  const site = renderSite({ business: b, brief: finalBrief, content, agency: config.agency, logoUrl, images, isDemo: false, siteUrl, ...share });
  writeSite(site, dir);

  let qa: QaReport | null = null;
  if (!opts.skipQa) {
    qa = await runQa(dir, site.pages, path.join(config.outputDir, "reports", `${slugify(b.name)}-production`), "production");
    store.setArtifact(b.id, "production_qa", qa);
  }
  store.log(b.id, "build", `production site built at ${dir}${qa ? ` (QA ${qa.passed ? "passed" : "FAILED"})` : ""}`);
  return { dir, qa, genericCopy };
}
