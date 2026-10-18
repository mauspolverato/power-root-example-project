# AI Web Agency — Phase 1

Finds local businesses whose websites are missing or weak, checks what's wrong with them, analyses their brand, and generates a **private website demo** plus a **priced proposal** for each good lead. Every demo is tested in a real browser and waits for you to review it. Nothing is sent to anyone automatically.

- Feasibility, costs, risks and roadmap: [docs/FEASIBILITY.md](docs/FEASIBILITY.md)
- Legal guardrails: [docs/COMPLIANCE.md](docs/COMPLIANCE.md)

## Quick start

```bash
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY for AI-written briefs and copy (optional)
npm run demo                  # offline end-to-end run on 3 fictional businesses
npm run agency -- serve       # open http://localhost:4173/<demo-folder>/
```

For the browser QA step you need Chromium: run `npx playwright-core install chromium` once, or set `CHROMIUM_PATH`.

Results:
- `output/demos/<business>-<token>/` — the demo site (static HTML/CSS, deployable anywhere)
- `output/reports/<business>-<token>/analysis.md` — internal: findings, score, design reasoning, QA, pricing, pre-contact checklist
- `output/reports/<business>-<token>/proposal.md` — client-facing proposal draft
- `output/reports/<business>-<token>/qa/{mobile,desktop}.png` — screenshots

## Real use

```bash
npm run agency -- discover --city "Bologna" --industry restaurant          # OpenStreetMap, free
npm run agency -- discover --city "Bologna" --industry dental --source google  # needs GOOGLE_PLACES_API_KEY
npm run agency -- import my-leads.csv                                       # your own list (format: fixtures/businesses.csv)
npm run agency -- run                       # process all newly discovered businesses
npm run agency -- list --stage ready_for_review
npm run agency -- show 12                   # full history of one lead
npm run agency -- suppress owner@shop.it "asked not to be contacted"
```

Options for `run`: `--id <n>` processes one business; `--all` re-runs everything; `--force` generates a demo even for unqualified leads; `--use-site-images` uses the business's own public photos in its private demo (see COMPLIANCE.md); `--skip-qa`.

## How it works

`discover/import → audit → score → brand signals → design brief (Claude) → copy (Claude) → render → browser QA (auto-repair once) → price → reports`

| Module | What it does |
|---|---|
| `src/discovery/` | OpenStreetMap Overpass, Google Places (New), CSV import |
| `src/audit/website.ts` | Fetches the homepage (respecting robots.txt) and measures HTTPS, mobile viewport, SEO tags, staleness, booking/menu/shop features and social links |
| `src/scoring/score.ts` | Lead score = need for a better site + ability to reach and sell to them |
| `src/brand/` | Extracts existing colors, fonts and logo; Claude turns them into a design brief that keeps the identity when it's worth keeping |
| `src/generator/` | Industry profiles, copy, and the renderer: palette, typography, 6 style systems, 3 hero layouts and section order vary per business; WCAG contrast is enforced |
| `src/qa/` | Playwright at 390px and 1366px: JS errors, broken links/assets, sideways scrolling, heading structure, axe-core WCAG 2 AA scan |
| `src/pricing/engine.ts` | One-time / subscription / hybrid suggestions, with costs, margins and every assumption listed |
| `src/ai.ts` | The only place Claude is called: structured output, refusal fallback, cost tracking, per-run spend ceiling |
| `src/db.ts` | SQLite (built into Node): businesses, artifacts, stages, event history, suppression list, AI usage |

Without `ANTHROPIC_API_KEY`, the brief and copy come from deterministic fallbacks. Fallback copy is in English and generic, so the AI path is what makes demos feel individually written in the local language.

## Development

```bash
npm test          # unit tests
npm run typecheck
```

Requires Node.js ≥ 22.13 (for the built-in SQLite driver).
