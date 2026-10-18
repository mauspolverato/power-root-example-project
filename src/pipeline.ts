import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { auditWebsite } from "./audit/website.ts";
import { buildBrief, heuristicBrief, sanitizeBrief } from "./brand/analyze.ts";
import { extractBrandSignals } from "./brand/extract.ts";
import { config } from "./config.ts";
import type { Store } from "./db.ts";
import { writeContent } from "./generator/content.ts";
import { renderSite, writeSite } from "./generator/render.ts";
import { quote } from "./pricing/engine.ts";
import { analysisReport, clientProposal } from "./proposal/proposal.ts";
import { type QaReport, runQa } from "./qa/check.ts";
import { scoreLead } from "./scoring/score.ts";
import type { BrandSignals, Business, DesignBrief, WebsiteAudit } from "./types.ts";

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
  const render = (br: DesignBrief) =>
    renderSite({
      business: b,
      brief: br,
      content,
      agency: config.agency,
      logoUrl: signals?.logoUrl,
      imageUrls: opts.useSiteImages ? signals?.imageUrls : undefined,
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
