import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { config } from "./config.ts";
import { Store } from "./db.ts";
import { importCsv } from "./discovery/csv.ts";
import { discoverGooglePlaces } from "./discovery/googlePlaces.ts";
import { discoverOsm, OSM_TAGS } from "./discovery/osm.ts";
import { buildProduction, exportEdits, processBusiness, slugify, summarize } from "./pipeline.ts";
import { serveDir } from "./qa/server.ts";
import { Industry, type BusinessInput } from "./types.ts";

const HELP = `AI web agency — Phase 1 CLI

  discover --city <name> --industry <type> [--source osm|google] [--limit 50]
  import <file.csv>                     Import leads from a CSV (see fixtures/businesses.csv)
  run [--id <n>] [--all] [--use-site-images] [--force] [--skip-qa]
                                        Audit, score, design, generate, QA and price
  edit <id>                             Export the generated copy/design to a JSON file you can edit
  build <id> [--domain https://x.com]   Build the real, publishable site (live WhatsApp booking, SEO files)
  list [--stage <stage>]                List businesses and their pipeline stage
  show <id>                             Everything we know about one business
  suppress <email-or-domain> [reason]   Never contact / never generate for this business
  serve [--port 4173] [--sites]         Serve generated demos (or production sites) locally
  demo                                  Offline end-to-end run on fictional fixtures

Industries: ${Industry.options.join(", ")}
AI: ${config.anthropicEnabled ? "Claude enabled" : "no ANTHROPIC_API_KEY — using heuristic brief/copy"}`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      city: { type: "string" },
      industry: { type: "string" },
      source: { type: "string", default: "osm" },
      limit: { type: "string", default: "50" },
      id: { type: "string" },
      all: { type: "boolean" },
      stage: { type: "string" },
      port: { type: "string", default: "4173" },
      "use-site-images": { type: "boolean" },
      force: { type: "boolean" },
      "skip-qa": { type: "boolean" },
      domain: { type: "string" },
      sites: { type: "boolean" },
    },
  });
  const store = new Store();

  switch (command) {
    case "discover": {
      const industry = Industry.parse(values.industry);
      if (!values.city) throw new Error("--city is required");
      let found: BusinessInput[];
      if (values.source === "google") found = await discoverGooglePlaces(values.city, industry, Number(values.limit));
      else {
        if (industry === "other") throw new Error("OSM discovery needs a specific industry");
        found = await discoverOsm(values.city, industry as keyof typeof OSM_TAGS, Number(values.limit));
      }
      for (const b of found) store.upsertBusiness(b);
      const noSite = found.filter((b) => !b.website).length;
      console.log(`Found ${found.length} ${industry} businesses in ${values.city} (${noSite} without a website listed).`);
      break;
    }
    case "import": {
      const file = positionals[0];
      if (!file) throw new Error("usage: import <file.csv>");
      const rows = importCsv(file);
      for (const b of rows) store.upsertBusiness(b);
      console.log(`Imported ${rows.length} businesses.`);
      break;
    }
    case "run": {
      const targets = values.id
        ? [store.getBusiness(Number(values.id))].filter((b) => b !== null)
        : store.listBusinesses(values.all ? undefined : "discovered");
      if (!targets.length) console.log("Nothing to run. Use discover/import first, or --all to re-run everything.");
      await runAll(store, targets, { useSiteImages: values["use-site-images"], force: values.force, skipQa: values["skip-qa"] });
      break;
    }
    case "edit": {
      const b = store.getBusiness(Number(positionals[0]));
      if (!b) throw new Error("No such business");
      console.log(`Edit this file, then run: npm run agency -- build ${b.id}\n${exportEdits(store, b)}`);
      break;
    }
    case "build": {
      const b = store.getBusiness(Number(positionals[0]));
      if (!b) throw new Error("No such business");
      const { dir, qa, genericCopy } = await buildProduction(store, b, { siteUrl: values.domain, skipQa: values["skip-qa"] });
      console.log(`Production site: ${dir}`);
      if (genericCopy) console.log(`WARNING: the text is generic fallback copy (no AI, no edits). Services/highlights may not match this business — run "npm run agency -- edit ${b.id}" and fix it before publishing.`);
      if (qa) {
        console.log(`QA: ${qa.passed ? "passed" : "FAILED"}`);
        for (const p of qa.problems) console.log(`  [${p.blocking ? "blocking" : "minor"}] ${p.viewport} ${p.page} ${p.kind}: ${p.detail}`);
        if (!qa.passed) process.exitCode = 1;
      }
      if (!b.photos.length) console.log("Note: no photos supplied — the site uses text-only layouts. Add a photos column (paths separated by |) and re-import for a richer site.");
      break;
    }
    case "list":
      for (const b of store.listBusinesses(values.stage)) console.log(summarize(store, b));
      break;
    case "show": {
      const b = store.getBusiness(Number(positionals[0]));
      if (!b) throw new Error("No such business");
      console.log(summarize(store, b));
      for (const kind of ["score", "audit", "brief", "quote", "qa", "demo"]) {
        const a = store.getArtifact(b.id, kind);
        if (a) console.log(`\n## ${kind}\n${JSON.stringify(a, null, 2).slice(0, 3000)}`);
      }
      console.log("\n## history");
      for (const e of store.events(b.id)) console.log(`${e.created_at} ${e.type}: ${e.message}`);
      break;
    }
    case "suppress": {
      if (!positionals[0]) throw new Error("usage: suppress <email-or-domain> [reason]");
      store.suppress(positionals[0], positionals.slice(1).join(" ") || "requested");
      console.log(`Suppressed ${positionals[0]}.`);
      break;
    }
    case "serve": {
      const kind = values.sites ? "sites" : "demos";
      const { url } = await serveDir(path.join(config.outputDir, kind), Number(values.port));
      console.log(`Serving ${kind} at ${url}/<folder>/  (Ctrl+C to stop)`);
      return; // keep running
    }
    case "demo":
      await demo();
      break;
    default:
      console.log(HELP);
  }
}

async function runAll(store: Store, targets: ReturnType<Store["listBusinesses"]> | NonNullable<ReturnType<Store["getBusiness"]>>[], opts: Parameters<typeof processBusiness>[2]) {
  for (const b of targets) {
    try {
      const r = await processBusiness(store, b, opts);
      console.log(`${summarize(store, b)}${r.previewDir ? `\n    demo: ${r.previewDir}` : ""}`);
    } catch (err) {
      store.log(b.id, "error", (err as Error).stack ?? String(err));
      store.setStage(b.id, "failed");
      console.error(`#${b.id} ${b.name} FAILED: ${(err as Error).message}`);
    }
  }
}

/** Runs the whole Phase 1 pipeline offline against fictional businesses and their fictional old websites. */
async function demo() {
  const { url } = await serveDir(path.resolve("fixtures/sites"), 4174);
  const csv = readFileSync("fixtures/businesses.csv", "utf8").replaceAll("{{BASE}}", url);
  const tmp = path.join(mkdtempSync(path.join(tmpdir(), "agency-")), "businesses.csv");
  writeFileSync(tmp, csv);
  const store = new Store(path.join(config.dataDir, "demo.db"));
  for (const b of importCsv(tmp)) store.upsertBusiness(b);
  console.log(`Fixture websites served at ${url}. Running pipeline...\n`);
  const all = store.listBusinesses();
  await runAll(store, all, {});

  console.log("\nBuilding production versions...");
  let failed = all.filter((b) => store.getStage(b.id) !== "ready_for_review").length;
  for (const b of all) {
    const { dir, qa } = await buildProduction(store, b, { siteUrl: `https://${slugify(b.name)}.example` });
    console.log(`  ${b.name}: ${dir} — QA ${qa?.passed ? "passed" : "FAILED"}`);
    for (const p of qa?.problems ?? []) console.log(`    [${p.blocking ? "blocking" : "minor"}] ${p.viewport} ${p.page} ${p.kind}: ${p.detail}`);
    if (!qa?.passed) failed++;
  }
  console.log(`\nReports: ${path.join(config.outputDir, "reports")}\nView demos: npm run agency -- serve   ·   production: npm run agency -- serve --sites`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
