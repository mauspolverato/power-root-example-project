import type { Business, LeadScore, WebsiteAudit } from "../types.ts";

// Lead score = how much a better website would help (need) x whether we can
// reach and sell to them (reachability). Weights are starting guesses; tune
// them once you have real reply/close data (see docs/FEASIBILITY.md §9).

const SEVERITY_POINTS = { high: 18, medium: 9, low: 3 } as const;
const HIGH_VALUE_INDUSTRIES = new Set(["restaurant", "hotel", "dental", "real_estate", "gym", "salon", "barber", "manufacturer"]);

export const QUALIFY_THRESHOLD = 45;

export function scoreLead(b: Business, audit: WebsiteAudit): LeadScore {
  const reasons: string[] = [];
  let need = 0;

  if (!audit.url) {
    need = 55;
    reasons.push("No website at all");
  } else if (!audit.reachable) {
    need = 50;
    reasons.push("Website is down");
  } else if (audit.robotsDisallowed) {
    need = 10;
    reasons.push("Site blocks crawlers — not audited");
  } else {
    for (const issue of audit.issues) need += SEVERITY_POINTS[issue.severity];
    if (audit.issues.length) reasons.push(`${audit.issues.length} website issues found`);
  }
  need = Math.min(need, 70);

  let reach = 0;
  const hasSocial = Object.keys({ ...b.socials, ...audit.socialLinks }).length > 0;
  if (b.email) (reach += 12), reasons.push("Public business email available");
  if (b.phone) (reach += 6), reasons.push("Public phone available");
  if (hasSocial) (reach += 6), reasons.push("Active social profile linked");
  if (hasSocial && !audit.url) (reach += 6), reasons.push("On social media but no website — strong fit");
  if (HIGH_VALUE_INDUSTRIES.has(b.industry)) (reach += 6), reasons.push(`${b.industry} benefits strongly from bookings/visibility`);
  reach = Math.min(reach, 30);

  // A business we cannot contact at all is not a lead, however bad its site.
  const contactable = Boolean(b.email || b.phone || hasSocial || audit.url);
  const score = contactable ? need + reach : 0;
  if (!contactable) reasons.push("No public contact channel — cannot qualify");

  return { score, qualified: score >= QUALIFY_THRESHOLD, reasons };
}
