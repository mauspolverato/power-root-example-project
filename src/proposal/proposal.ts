import { localeFor } from "../generator/i18n.ts";
import type { QaReport } from "../qa/check.ts";
import type { AuditIssue, Business, DesignBrief, LeadScore, PriceQuote, WebsiteAudit } from "../types.ts";

// Two documents per lead, both for HUMAN review before anything is sent:
// 1. the internal analysis report (why this lead, what we found, QA status) — English
// 2. the client-facing proposal (what we'd build, why, and what it costs) — in the client's language

const money = (q: PriceQuote, n: number) => `${q.symbol}${n.toLocaleString("en-US")}`;

export function analysisReport(opts: { business: Business; audit: WebsiteAudit; score: LeadScore; brief: DesignBrief; briefSource: string; contentSource: string; qa: QaReport | null; quote: PriceQuote; previewUrl: string; aiCostUsd: number }): string {
  const { business: b, audit, score, brief, qa, quote: q } = opts;
  return `# ${b.name} — lead analysis (internal)

- **Industry:** ${b.industry} · **City:** ${b.city ?? "?"} · **Country:** ${b.country ?? "?"} · **Source:** ${b.source} (${b.sourceId})
- **Website:** ${audit.url ?? "none"} · **Contact:** ${[b.email, b.phone, b.whatsapp && `WhatsApp ${b.whatsapp}`].filter(Boolean).join(" / ") || "none public"}
- **Socials:** ${Object.entries({ ...b.socials, ...audit.socialLinks }).map(([k, v]) => `${k}: ${v}`).join(", ") || "none found"}
- **Own photos supplied:** ${b.photos.length}
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

## Suggested pricing (${q.tier}, ${q.currency})
- One-time: ${money(q, q.oneTime.price)} (margin ~${q.marginOneTime}%)
- Subscription: ${money(q, q.subscription.monthly)}/month, ${q.subscription.minimumMonths}-month minimum (margin ~${q.marginMonthly}%)
- Hybrid: ${money(q, q.hybrid.setup)} + ${money(q, q.hybrid.monthly)}/month
- Market reference: ${money(q, q.marketRange.low)}–${money(q, q.marketRange.high)}. ${q.marketRange.note}

Assumptions:
${q.assumptions.map((a) => `- ${a}`).join("\n")}

## Before contacting this business — checklist
- [ ] Look at the preview yourself on a phone. Would you be proud to send it?
- [ ] Every fact on the preview is true (name, address, hours, phone). Nothing invented.
- [ ] Not on the suppression list.
`;
}

const ISSUE_ES: Record<string, string> = {
  no_website: "No encontramos una página web de tu negocio: quien te busca en Google solo ve lo que muestran los directorios y las redes sociales.",
  unreachable: "Tu página web actual no está cargando.",
  no_https: "Tu página no usa conexión segura (HTTPS); el navegador la marca como \"No segura\".",
  not_mobile: "Tu página no está adaptada al celular, que es desde donde te visita la mayoría de tus clientes.",
  no_title: "Tu página no tiene título, lo que afecta cómo apareces en Google.",
  no_meta_description: "Tu página no tiene descripción para Google, así que el buscador muestra un texto al azar.",
  slow: "Tu página tarda mucho en cargar.",
  stale: "Tu página parece desactualizada.",
  no_booking: "Tus clientes no pueden pedir una cita o reserva desde la página.",
  no_menu: "No encontramos tu menú en la página.",
  no_shop: "No tienes catálogo ni pedidos en línea.",
};

function issueText(i: AuditIssue, lang: "es" | "en"): string {
  return lang === "es" ? (ISSUE_ES[i.code] ?? i.message) : i.message;
}

export function clientProposal(opts: { business: Business; audit: WebsiteAudit; brief: DesignBrief; quote: PriceQuote; previewUrl: string; agency: { name: string; email: string; address: string } }): string {
  const { business: b, audit, quote: q, agency } = opts;
  const lang = localeFor(b);
  const findings = audit.issues.filter((i) => i.severity !== "low").slice(0, 4);
  const date = new Date().toISOString().slice(0, 10);
  const contact = `${agency.name || "—"} · ${agency.email}${agency.address ? ` · ${agency.address}` : ""}`;

  if (lang === "es") {
    const socialOnly = !audit.url && Object.keys(b.socials).length > 0;
    return `# Una página web para ${b.name}

${agency.name ? `**Preparado por ${agency.name}** · ` : ""}${date}

Preparamos, sin costo, una propuesta de cómo podría verse la página web de ${b.name}:

**${opts.previewUrl}**

Es una vista previa privada hecha con la información pública de tu negocio. No está publicada en ningún sitio oficial y nada sale al aire sin tu aprobación. Si prefieres que la borremos, solo respóndenos.

## Lo que notamos
${findings.length ? findings.map((f) => `- ${issueText(f, "es")}`).join("\n") : "- Tu página funciona, pero puede ser más rápida en el celular y más fácil para que un cliente nuevo te escriba o reserve."}
${socialOnly ? "- Tienes presencia en redes sociales, pero quien te busca en Google no encuentra una página propia con tu horario, ubicación y servicios.\n" : ""}
## Qué incluye la nueva página
${q.features.map((f) => `- ${f}`).join("\n")}

## Tres formas de trabajar con nosotros
| Opción | Precio | Ideal si… |
|---|---|---|
| **Pago único** | ${money(q, q.oneTime.price)} | quieres que la página sea tuya y encargarte tú del hosting y los cambios |
| **Mensual** | ${money(q, q.subscription.monthly)}/mes (mínimo ${q.subscription.minimumMonths} meses) | quieres que nos encarguemos del hosting, actualizaciones y cambios pequeños |
| **Inicial + mantenimiento** | ${money(q, q.hybrid.setup)} + ${money(q, q.hybrid.monthly)}/mes | quieres pagar menos al inicio y tener soporte continuo |

Precios en ${q.currency === "USD" ? "dólares estadounidenses" : q.currency}. No incluyen el dominio (por ejemplo, tunegocio.com) ni servicios de terceros que elijas.

## Próximos pasos
1. Dinos qué cambiarías de la vista previa: textos, fotos, colores.
2. Nos envías tus fotos reales, tu menú o servicios y tus precios (por WhatsApp está perfecto).
3. Hacemos los ajustes, tú apruebas y publicamos la página en tu dominio.

${contact}
`;
  }

  return `# A new website for ${b.name}

${agency.name ? `**Prepared by ${agency.name}** · ` : ""}${date}

We put together a free concept of what a new website for ${b.name} could look like:

**${opts.previewUrl}**

It's a private preview built from your publicly available information. It isn't published anywhere official, and nothing goes live without your approval. If you'd prefer we delete it, just reply and we will.

## What we noticed
${findings.length ? findings.map((f) => `- ${issueText(f, "en")}`).join("\n") : "- Your current site works, but there's room to make it faster to use on a phone and easier for new customers to act on."}

## What the new site includes
${q.features.map((f) => `- ${f}`).join("\n")}

## Three ways to work with us
| Option | Price | Best if you… |
|---|---|---|
| **One-time** | ${money(q, q.oneTime.price)} | want to own it outright and handle hosting/updates yourself |
| **Monthly** | ${money(q, q.subscription.monthly)}/month (${q.subscription.minimumMonths}-month minimum) | want hosting, updates, security and small changes taken care of |
| **Setup + care plan** | ${money(q, q.hybrid.setup)} + ${money(q, q.hybrid.monthly)}/month | want a lower start plus ongoing support |

Prices exclude taxes where applicable, your domain name, and any third-party subscriptions you choose.

## Next steps
1. Tell us what you'd change in the preview — wording, photos, colours.
2. You send us your real photos, menu/services and prices.
3. We finalise, you approve, and we launch on your domain together.

${contact}
`;
}
