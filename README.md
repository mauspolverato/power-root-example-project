# AI Web Agency — Phase 1

Finds local businesses whose websites are missing or weak, checks what's wrong with them, analyses their brand, and generates a **private website demo** plus a **priced proposal** for each good lead. When a business says yes, it builds the **real, publishable site**. Every site is tested in a real browser. Nothing is sent to anyone automatically.

Built for Venezuela first: sites are in Spanish, bookings arrive on the business's **WhatsApp** already written out (no server or monthly fees), prices are in USD at local price levels, and phone numbers are handled in Venezuelan formats. Other countries work too (English sites, local currency).

- Feasibility, costs, risks and roadmap: [docs/FEASIBILITY.md](docs/FEASIBILITY.md)
- Legal guardrails: [docs/COMPLIANCE.md](docs/COMPLIANCE.md)

## Quick start

```bash
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY for AI-written briefs and copy (optional)
npm run demo                  # offline end-to-end run on 3 fictional Venezuelan businesses (demo + production build)
npm run agency -- serve       # open http://localhost:4173/<demo-folder>/
```

For the browser QA step you need Chromium: run `npx playwright-core install chromium` once, or set `CHROMIUM_PATH`.

Results:
- `output/demos/<business>-<token>/` — the demo site (static HTML/CSS, deployable anywhere)
- `output/reports/<business>-<token>/analysis.md` — internal: findings, score, design reasoning, QA, pricing, pre-contact checklist
- `output/reports/<business>-<token>/proposal.md` — client-facing proposal draft
- `output/reports/<business>-<token>/qa/{mobile,desktop}.png` — screenshots
- `output/sites/<business>/` — the production version, ready to upload (see "From demo to live site")

## Real use

```bash
npm run agency -- discover --city "Caracas" --industry restaurant          # OpenStreetMap, free
npm run agency -- discover --city "Valencia" --industry dental --source google  # needs GOOGLE_PLACES_API_KEY
npm run agency -- import my-leads.csv                                       # your own list (format: fixtures/businesses.csv)
npm run agency -- run                       # process all newly discovered businesses
npm run agency -- list --stage ready_for_review
npm run agency -- show 12                   # full history of one lead
npm run agency -- suppress owner@shop.example "asked not to be contacted"
```

### From demo to live site

```bash
npm run agency -- edit 1                                    # writes data/edits/1-<name>.json — fix the copy, services, prices, colours
npm run agency -- build 1 --domain https://elbudare.com     # builds output/sites/<name>/ and tests it
npm run agency -- serve --sites                             # look at it locally
```

The production build differs from the demo:
- no preview banner
- search engines allowed
- schema.org business data, canonical URLs, `sitemap.xml`, a 404 page and a favicon
- the booking form **really opens WhatsApp** with the request filled in, or the visitor's email app if the business has no mobile number
- photos are compressed to WebP (800/1600px) with a JPEG fallback, and QA fails any page over 3 MB
- `og.png` (the preview card shown when the link is shared on WhatsApp) and a home-screen icon are generated
- placeholder images never appear: sections without photos switch to text layouts

`build` warns you if the text is still generic fallback copy.

Upload the folder to any static host, for example Cloudflare Pages (free): drag and drop the folder in the dashboard, or run `npx wrangler pages deploy output/sites/<name>`.

**Photos:** add a `photos` column to your CSV, with file paths or URLs separated by `|`, best photo first. Photo 1 becomes the hero, photo 2 goes in "about", and photos 3–7 make up the gallery. Re-import the CSV, then run `build` again.

**Logo:** add a `logo` column (file path or URL).

**Clients folder:** `clients/<name>/` holds a client's CSV, hand-written copy (`site.json`, used with `build --content`), assets and the built site, for example `clients/fibraspol/`.

**Instagram-only businesses:** if there is no WhatsApp or email, the request form copies the message and opens the business's Instagram chat (`ig.me`).

**WhatsApp:** Venezuelan mobile numbers (0412/0414/0416/0422/0424/0426) are detected automatically. Use a `whatsapp` column if the business uses a different number.

Options for `run`: `--id <n>` processes one business; `--all` re-runs everything; `--force` generates a demo even for unqualified leads; `--use-site-images` uses the business's own public photos in its private demo (see COMPLIANCE.md); `--skip-qa`.

## How it works

`discover/import → audit → score → brand signals → design brief (Claude) → copy (Claude) → render → browser QA (auto-repair once) → price → reports`

| Module | What it does |
|---|---|
| `src/discovery/` | OpenStreetMap Overpass, Google Places (New), CSV import |
| `src/audit/website.ts` | Fetches the homepage (respecting robots.txt) and measures HTTPS, mobile viewport, SEO tags, staleness, booking/menu/shop features and social links |
| `src/scoring/score.ts` | Lead score = need for a better site + ability to reach and sell to them |
| `src/brand/` | Extracts existing colors, fonts and logo; Claude turns them into a design brief that keeps the identity when it's worth keeping |
| `src/generator/` | Industry profiles, Spanish/English text (`i18n.ts`), phone/WhatsApp handling, copy, and the renderer. Palette, typography, 6 style systems, 4 hero layouts and section order vary per business; WCAG contrast is enforced |
| `src/qa/` | Playwright at 390px and 1366px: JS errors, broken links/assets, sideways scrolling, heading structure, an axe-core WCAG 2 AA scan, the mobile menu, a real booking-form submission (checks that WhatsApp opens with the details), and no placeholders in production |
| `src/pricing/engine.ts` | One-time / subscription / hybrid suggestions, with costs, margins and every assumption listed |
| `src/ai.ts` | The only place Claude is called: structured output, refusal fallback, cost tracking, per-run spend ceiling |
| `src/db.ts` | SQLite (built into Node): businesses, artifacts, stages, event history, suppression list, AI usage |

Without `ANTHROPIC_API_KEY`, the brief and copy come from deterministic fallbacks. Fallback copy is generic (correct language, but the same services for every business of a type), so either use the AI or edit the copy with `edit` before publishing.

## Development

```bash
npm test          # unit tests
npm run typecheck
```

Requires Node.js ≥ 22.13 (for the built-in SQLite driver).
