import type { Business, DesignBrief, LeadScore, PriceQuote, WebsiteAudit } from "../types.ts";
import type { QaReport } from "../qa/check.ts";

// Two documents per lead, both for HUMAN review before anything is sent:
// 1. the internal analysis report (why this lead, what we found, QA status)
// 2. the client-facing proposal (what we'd build, why, and what it costs)

const eur = (n: number) => `€${n.toLocaleString("en-US")}`;

export function analysisReport(opts: { business: Business; audit: WebsiteAudit; score: LeadScore; brief: DesignBrief; briefSource: string; contentSource: string; qa: QaReport | null; quote: PriceQuote; previewUrl: string; aiCostUsd: number }): string {
  const { business: b, audit, score, brief, qa, quote: q } = opts;
  return `# ${b.name} — lead analysis (internal)

- **Industry:** ${b.industry} · **City:** ${b.city ?? "?"} · **Source:** ${b.source} (${b.sourceId})
- **Website:** ${audit.url ?? "none"} · **Contact:** ${[b.email, b.phone].filter(Boolean).join(" / ") || "none public"}
- **Socials:** ${Object.entries({ ...b.socials, ...audit.socialLinks }).map(([k, v]) => `${k}: ${v}`).join(", ") || "none found"}
- **Lead score:** ${score.score}/100 — ${score.qualified ? "QUALIFIED" : "not qualified"}
- **Preview:** ${opts.previewUrl}
- **AI spend on this lead:** $${opts.aiCostUsd.toFixed(3)} · brief: ${opts.briefSource}, copy: ${opts.contentSource}

## Why this lead
${score.reasons.map((r) => `- ${r}`).join("\n")}

## Website findings (measured)
${audit.issues.length ? audit.issues.map((i) => `- **${i.severity}** — ${i.message}`).join("\n") : "- No significant issues found."}

## Design direction
- Positioning: ${brief.positioning}
- Tone: ${brief.toneOfVoice} · Style: ${brief.style} · Hero: ${brief.layout.hero}
- Palette: ${Object.entries(brief.palette).map(([k, v]) => `${k} ${v}`).join(", ")}
- Type: ${brief.typography.heading} / ${brief.typography.body}
- Keeps existing identity: ${brief.preserveExistingIdentity ? "yes" : "no"}
${brief.reasons.map((r) => `- ${r}`).join("\n")}

## Automated QA
${qa ? `${qa.passed ? "PASSED" : "FAILED"} (${qa.problems.length} findings)\n${qa.problems.map((p) => `- [${p.blocking ? "blocking" : "minor"}] ${p.viewport} ${p.kind}: ${p.detail}`).join("\n")}` : "Not run."}

## Suggested pricing (${q.tier})
- One-time: ${eur(q.oneTime.price)} (margin ~${q.marginOneTime}%)
- Subscription: ${eur(q.subscription.monthly)}/month, ${q.subscription.minimumMonths}-month minimum (margin ~${q.marginMonthly}%)
- Hybrid: ${eur(q.hybrid.setup)} + ${eur(q.hybrid.monthly)}/month
- Market reference: ${eur(q.marketRange.low)}–${eur(q.marketRange.high)}. ${q.marketRange.note}

Assumptions:
${q.assumptions.map((a) => `- ${a}`).join("\n")}

## Before contacting this business — checklist
- [ ] Look at the preview yourself on a phone. Would you be proud to send it?
- [ ] Every fact on the preview is true (name, address, hours, phone). Nothing invented.
- [ ] Contact is a published *business* address, not a personal one; not on the suppression list.
- [ ] Outreach is lawful in ${b.country ?? "their country"} for B2B (see docs/COMPLIANCE.md).
`;
}

export function clientProposal(opts: { business: Business; audit: WebsiteAudit; brief: DesignBrief; quote: PriceQuote; previewUrl: string; agency: { name: string; email: string; address: string } }): string {
  const { business: b, audit, quote: q, agency } = opts;
  const findings = audit.issues.filter((i) => i.severity !== "low").slice(0, 4);
  return `# A new website for ${b.name}

**Prepared by ${agency.name}** · ${new Date().toISOString().slice(0, 10)}

We put together a free concept of what a new website for ${b.name} could look like:

**${opts.previewUrl}**

It's a private preview built from your publicly available information. It isn't published anywhere official, and nothing goes live without your approval. If you'd prefer we delete it, just reply and we will.

## What we noticed
${findings.length ? findings.map((f) => `- ${f.message}`).join("\n") : audit.url ? "- Your current site works, but there's room to make it faster to use on a phone and easier for new customers to act on." : "- We couldn't find a website for you — customers searching online only see what directories and social media show."}

## What the new site includes
${q.features.map((f) => `- ${f}`).join("\n")}

## Three ways to work with us
| Option | Price | Best if you… |
|---|---|---|
| **One-time** | ${eur(q.oneTime.price)} | want to own it outright and handle hosting/updates yourself |
| **Monthly** | ${eur(q.subscription.monthly)}/month (${q.subscription.minimumMonths}-month minimum) | want hosting, updates, security and small changes taken care of |
| **Setup + care plan** | ${eur(q.hybrid.setup)} + ${eur(q.hybrid.monthly)}/month | want a lower start plus ongoing support |

Prices exclude VAT where applicable, your domain name, and any third-party booking or shop subscriptions you choose.

## Next steps
1. Tell us what you'd change in the preview — wording, photos, colours.
2. You send us your real photos, menu/services and prices.
3. We finalise, you approve, and we launch on your domain together.

${agency.name} · ${agency.email}${agency.address ? ` · ${agency.address}` : ""}
`;
}
