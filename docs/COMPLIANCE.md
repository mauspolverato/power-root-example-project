# Compliance guardrails

This is an engineering checklist, not legal advice. Before you send the first message, book about an hour with a lawyer in your country to confirm the outreach channel and the privacy notice.

## Built into Phase 1
- **Honest crawler.** Identifies itself (`AgencyAuditBot` + your contact email), respects robots.txt, and fetches one page plus up to 3 stylesheets per business.
- **No social scraping.** Social profiles come only from links the business publishes (on its site or in OSM), or from you.
- **Demo safeguards.** A visible "concept preview, not affiliated or approved" banner, `noindex,nofollow,noarchive`, a disallow-all robots.txt, a random URL token, a one-click removal request, forms that can't send anything, and no schema.org markup in demos (so search engines can't treat them as the business).
- **No fabrication.** Prompts forbid invented prices, reviews, awards and history. Fallback copy is generic and clearly placeholder. Audit findings are measured facts.
- **Own assets off by default.** Brand-colored placeholders replace the business's photos unless you pass `--use-site-images`.
- **Suppression list.** `npm run agency -- suppress <email-or-domain>`. Suppressed businesses are skipped by the pipeline. Phase 3 will check the list before every send.
- **Human checklist.** Every `analysis.md` ends with a checklist to complete before contact.

## Outreach rules by country (to implement in Phase 3, confirm locally)
| Country | Cold B2B email | Safer first channel |
|---|---|---|
| Italy | Prior consent generally required (art. 130 Codice Privacy), including for businesses | In person, postal letter with QR code, phone (check the Registro delle Opposizioni) |
| Germany | Prior consent required (UWG §7); "presumed consent" is narrow | In person, letter |
| France | Allowed to professional addresses if the offer relates to the person's job; opt-out required | Email with opt-out, or in person |
| UK | Allowed to corporate subscribers with an opt-out; sole traders/partnerships need consent | Email to limited companies; in person otherwise |
| US | Allowed with an accurate sender, a postal address and a working opt-out (CAN-SPAM) | Email |

Every message must include: who you are, your postal address, why you're contacting them, where you got their details, how to opt out (honoured immediately and permanently), and a link to your privacy notice (GDPR art. 14).

Operational limits for Phase 3: a human approves each first message; a small daily cap per sending domain (start around 20/day); no follow-up after an opt-out or after two unanswered follow-ups; separate sending domain from your main domain.

## Contracts, payments and launch (Phase 4)
- Written scope and price, accepted by the client, before any work beyond the demo.
- The client supplies or licenses all photos and logos and confirms in writing that they have the rights.
- Domain registered in the **client's** name; DNS changed only with their written authorization.
- Production sites: self-hosted fonts, cookie-free analytics (or a consent banner), a completed privacy notice, and a data-processing agreement if you host the forms.
