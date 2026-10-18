# Feasibility assessment, costs and roadmap

**Bottom line:** the business can be built with today's technology, and most of the *production* work (finding businesses, auditing them, designing, generating and testing demo sites, pricing, drafting proposals) can run with little supervision. The *selling* parts — first contact, negotiation, contracts, payment, launch on a real domain — should stay human-approved. That's partly because of the law. It's also because those are the steps where a mistake costs you a client or your reputation. Treat this as an "AI-leveraged one-person agency", not an agency with no humans in it.

Phase 1 is implemented in this repository and tested end-to-end offline (see README). Everything below marked *(estimate)* is a planning number, not a measured one.

---

## 1. Can the entire workflow be automated with current technology?

Technically, almost all of it can. Responsibly and profitably, about 70–80% of it can.

| Step | Automatable? | Notes |
|---|---|---|
| Discovery | Yes | OpenStreetMap (free), Google Places API (paid), CSV imports. Social networks: only links the business publishes itself, or official APIs the business connects. Scraping Instagram, Facebook or TikTok breaks their terms. |
| Website audit | Yes | Deterministic checks, measured facts (implemented). |
| Brand analysis | Yes, with review | Claude reads the site's text, colors and fonts and writes a brief (implemented). |
| Site generation | Yes, with review | Implemented. Quality comes from the brief plus the design system, not from the LLM writing raw HTML. Raw-HTML generation is less consistent and harder to QA. |
| QA | Yes | Real browser at phone and desktop sizes, axe-core accessibility, links, overflow and JS errors (implemented). |
| Pricing and proposal | Yes, with review | Implemented with explicit assumptions. |
| Outreach | Drafting: yes. Sending: human-approved | The law, deliverability and reputation set the limits here, not the technology. See COMPLIANCE.md. |
| Replies, FAQs, scheduling | Partly | An AI can draft answers. Price changes and commitments need a human. |
| Contracts, payments, domains, go-live | Human-approved, tool-assisted | These steps create legal and financial obligations. |
| Maintenance and monitoring | Yes | Uptime checks, dependency updates and backups on static sites are low-touch. |

## 2. What runs unsupervised vs. what needs approval

**Unsupervised:** discovery, auditing, scoring, brief, copy, rendering, QA, pricing suggestion, report generation, uptime monitoring, renewal reminders.

**Human approval required:**
- Before any message is sent. Phase 3 adds an approval queue. Later you can allow auto-send for follow-ups to people who already replied.
- Before a demo URL is shared. You look at it on your phone.
- Any price that differs from the suggestion, any discount, any contract.
- Payments and refunds.
- Domain/DNS changes and publishing to the client's domain. These need the client's written authorization.
- Anything the AI drafts that makes a factual claim about the business.

## 3. Required services

| Need | Choice | Why | Cost *(estimate)* |
|---|---|---|---|
| Runtime | Node.js 22 + TypeScript | One language for pipeline, dashboard and sites | free |
| AI | Claude API (`claude-opus-5-5`), behind one wrapper (`src/ai.ts`) | Strong at structured design reasoning and copy; swappable | ~$0.10–0.40 per lead (2 calls) |
| Discovery | OpenStreetMap Overpass (default), Google Places API (New) optional | OSM is free and openly licensed. Places has better coverage | OSM free; Places is paid per request, with a monthly free allowance. Check current pricing |
| Database | SQLite (built into Node), then Postgres (Neon/Supabase) | Zero setup now, same tables later | free → ~$0–25/mo |
| Demo + client hosting | Static files on Cloudflare Pages / Netlify | Fast, free tier, nothing to patch | free for most volumes |
| Browser QA | Playwright + Chromium, axe-core | Real rendering checks | free |
| Email (Phase 3) | Your own domain mailbox (Google Workspace / Fastmail) + a transactional API (Postmark/Resend) for tracked sends | Deliverability, opt-out handling | ~€6–20/mo |
| Scheduling | Cal.com or Calendly link | Don't build this yourself | free–€12/mo |
| Payments (Phase 4) | Stripe (Checkout + Billing for subscriptions) | Invoices, SEPA, cards, dunning | ~1.5% + €0.25 per EU card payment |
| E-commerce clients | Shopify or Stripe Payment Links embedded | Never build a custom checkout | client pays |
| Monitoring (Phase 5) | UptimeRobot / Better Stack | Uptime + SSL expiry alerts | free–€20/mo |
| Dashboard (Phase 2) | Next.js + Tailwind, deployed on Vercel or your server | Matches the stack you asked for | free tier |

**Why demo sites are static HTML, not Next.js apps:** a restaurant site doesn't need a server. Static output loads faster, hosts for free and has no security patching. A non-developer can also edit it before a sale. The generator is a module, so if a client needs an app (a member area, for example) you can add a Next.js target later without changing the rest. The dashboard, which is a real application, will be Next.js.

## 4. Costs

*(estimates; replace them with real numbers after the first 50 leads)*

**Initial (one-off):** about €0–150. That covers a domain for your agency (~€15), a business email (~€6/mo), an optional logo, and roughly an hour with a local lawyer to check your outreach approach. **That legal review is the most valuable money you will spend.**

**Monthly at small scale (≈200 leads analysed, 50 demos, 10 clients):**
- Claude: 200 leads × ~$0.25 ≈ **$50**. Only qualified leads reach the AI steps. The Batch API (−50%) can halve this in Phase 5.
- Google Places (optional): a few euros, or €0 with OSM.
- Email + scheduling: ~€15–30.
- Hosting: €0 (static free tiers).
- Monitoring: €0–20.
- **Total ≈ €70–130/month.** Your time is the real cost: plan on 3–6 hours per sold site for content, edits and launch.

**Unit economics, Business tier, Italian price level (what the engine outputs today):** one-time €1,090 against ~€280 of your time plus AI cost, or a €64/month subscription against ~€39/month of upkeep (mostly your time). With 10 subscription clients that's ~€640 MRR. With 40, ~€2,560 MRR. Whether you reach those numbers depends on the close rate, which nobody knows until you measure it.

## 5. Main risks

**Legal and privacy (highest):**
- **Unsolicited email.** In Italy (art. 130 Privacy Code) and Germany (UWG §7), marketing email generally needs **prior consent, even to businesses**. In the UK, B2B email to corporate addresses is allowed with an opt-out, but sole traders are treated as consumers. The US (CAN-SPAM) allows it with an opt-out and a postal address. Your outreach channel must therefore depend on the country. See COMPLIANCE.md.
- **GDPR.** Business data about identifiable people (a sole trader's name, a personal email) is personal data. You need a legitimate-interest assessment, an Article 14 notice at first contact, minimal retention, and deletion on request. The suppression list is built in.
- **Impersonation and passing off.** A demo that looks like the official site could mislead customers. Mitigated: every demo has a "concept preview, not affiliated" banner, `noindex`, a disallow-all robots.txt, an unguessable URL and a removal link.
- **Copyright and trademarks.** Their photos and logo belong to them, or to their photographer. The default is brand-colored placeholders. Use `--use-site-images` only for a private demo shown to the owner, and never publish their assets without permission. Fonts load from Google Fonts in demos. Production sites should self-host fonts, because a German court ruled Google Fonts embedding a GDPR violation (LG München, 2022).
- **Data source terms.** Google Places limits caching (place IDs only, long-term). OSM data requires attribution if you republish it. Never scrape Meta or TikTok.
- **AI fabrication.** Prompts forbid invented facts, prices and reviews, and every demo is human-reviewed before it is shared. The audit reports only measured issues.

**Technical:** sites block crawlers (handled: robots.txt respected, lead marked). Sites rely on JavaScript (the audit sees raw HTML only; a Phase 5 upgrade is to audit through Playwright). Model output varies (handled: schema-validated output, sanitized palettes and sections, QA plus an automatic fallback re-render). API costs (handled: per-run spend ceiling).

**Commercial:** see §9.

## 6. Simplest version that can earn the first paying client

You already have it:
1. Pick **one industry in one city** (e.g. restaurants in your town). `discover` + `run`.
2. Open the 10 best demos on your phone. Fix anything embarrassing by hand.
3. **Visit or call the 10 best in person** with the demo on your phone, or send a printed letter with a QR code to the preview. Both are legal in places where cold email isn't, and both convert far better.
4. If someone says yes: collect their real photos and menu, edit the demo, take payment with a **Stripe Payment Link**, and deploy the folder to **Cloudflare Pages** on their domain with their DNS access.

No dashboard, CRM or automation is needed until you've closed 2–3 clients. Those clients will tell you what to automate next.

## 7. Differentiation

- **Show, don't pitch.** Agencies send a portfolio. You send *their own* site, already built. That is the core advantage.
- **Between DIY and agency:** cheaper and faster than an agency (live in days, not weeks), and no work for the owner, unlike Wix or Squarespace.
- **Done-for-you care plan:** hosting, updates, menu and price changes by message, uptime monitoring, and a short monthly report. The subscription is the business. One-time sales only pay for client acquisition.
- **Niche plus local:** become the restaurant-website person in one city. Your portfolio and referrals compound within a niche.
- **Honest audits:** every claim in a pitch is a measured fact (no HTTPS, not mobile-friendly, no booking). There are no fake "you're losing €X/month" claims.

## 8. Timeline for a beginner programmer

*(part-time, ~10 h/week)*

| Phase | Scope | Status / time |
|---|---|---|
| 1 | Discovery, audit, brand brief, demo generation, QA, pricing, reports | **Done here.** 1–2 weeks for you to learn it, tune templates and run it on your city |
| 2 | Next.js dashboard: lead table, filters, demo gallery, scoring tweaks, proposal editor; move to Postgres | 4–6 weeks |
| 3 | Outreach drafts, approval queue, per-country channel rules, opt-out links, sending limits, reply tracking, CRM stages | 4–6 weeks |
| 4 | Onboarding form (content/photo upload), Stripe Checkout + Billing, contract template + e-signature, deploy to Cloudflare Pages via API, DNS instructions | 6–8 weeks |
| 5 | Uptime/SSL monitoring, backups, monthly client reports, Batch API for cost, scheduled discovery, job queue, error alerts | ongoing |

That's 5–6 months to the full system. **Don't wait for it:** sell with Phase 1 from week 2.

## 9. Most likely reasons this fails

1. **Low reply rate.** Small-business owners ignore unknown contacts. Mitigate with in-person and phone outreach, a narrow niche, and a demo good enough to forward.
2. **"Instagram is enough for me."** Many really don't need a website. Score for need, and pitch bookings and Google visibility, not "a website".
3. **Generic-looking demos.** If every demo looks alike, the core advantage disappears. Invest in more section variants and real-photo workflows (Phase 2).
4. **Legal or spam complaint.** One complaint to a data protection authority, or a blacklisted domain, can end the email channel. Follow COMPLIANCE.md and never mass-send.
5. **Support burden kills margin.** Subscription clients ask for many small changes. Cap the included changes per month and keep sites static.
6. **Competing on price.** There will always be a cheaper freelancer. Compete on speed and on care.
7. **Building too much before selling.** The biggest risk for a technical founder. Sell first.

## 10. Scaling while keeping costs low

- Static sites: hosting cost per client stays ≈ €0.
- **Cheap work before expensive work:** deterministic audit and scoring first. Only qualified leads reach Claude, and only top leads get demos.
- One AI wrapper (`src/ai.ts`) with spend tracking, a per-run budget and model choice in one place. Move bulk analysis to the Batch API (half price) and measure whether a smaller model holds quality for simple steps.
- Idempotent, resumable pipeline: every step stores its result, so reruns and crashes don't double-spend.
- Move SQLite → Postgres and loops → a job queue (pg-boss) only when one machine can't keep up.
- Replaceable modules: discovery sources, AI provider, renderer, host and email provider each sit behind one file.

---

## Architecture

```
discovery/ (osm, googlePlaces, csv)  ─┐
                                      ▼
                      db.ts (SQLite: businesses, artifacts, stages, events, suppression, ai_usage)
                                      ▲
pipeline.ts ── audit/website.ts → scoring/score.ts → brand/extract.ts → brand/analyze.ts (Claude)
           └─ generator/content.ts (Claude) → generator/render.ts → qa/check.ts (Playwright+axe)
           └─ pricing/engine.ts → proposal/proposal.ts → output/{demos,reports}/
cli.ts — the operator's interface (dashboard in Phase 2)
```

Every lead moves through stages: `discovered → audited → qualified|disqualified → analyzed → generated → qa_passed|qa_failed → ready_for_review`. Each step's output is stored as an artifact, and every stage change is logged in `events`, which gives you the activity history.

**Security:** keys only in `.env` (git-ignored); no secrets in generated sites; HTML is escaped everywhere; the local file server blocks path traversal; Claude output is schema-validated and sanitized before rendering. Phase 2 adds authentication to the dashboard (single operator, Auth.js or Cloudflare Access).
