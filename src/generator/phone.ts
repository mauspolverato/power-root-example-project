// Phone helpers. In Venezuela (and most of Latin America) customers reach
// small businesses on WhatsApp, so a mobile number is the booking channel.

const DIAL_CODES: Record<string, string> = { VE: "58", CO: "57", MX: "52", AR: "54", CL: "56", PE: "51", EC: "593", PA: "507", DO: "1", ES: "34", IT: "39", US: "1", GB: "44" };

// Venezuelan mobile prefixes (Movilnet, Movistar, Digitel).
const VE_MOBILE = /^(412|414|416|422|424|426)/;

/** Normalise to E.164 digits without "+", e.g. "0414-123.45.67" (VE) -> "584141234567". Null if unparseable. */
export function toE164(phone: string | undefined, country: string | undefined): string | null {
  if (!phone) return null;
  const raw = phone.trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return digits.length >= 8 ? digits : null;
  if (digits.startsWith("00")) return digits.slice(2);
  const code = DIAL_CODES[(country ?? "").toUpperCase()];
  if (!code) return digits.length >= 10 ? digits : null;
  if (digits.startsWith(code) && digits.length > 10) return digits;
  digits = digits.replace(/^0/, ""); // national trunk prefix
  return code + digits;
}

/** Best guess whether a number can receive WhatsApp messages. */
export function isLikelyWhatsApp(e164: string | null, country: string | undefined): boolean {
  if (!e164) return false;
  if ((country ?? "").toUpperCase() === "VE") return VE_MOBILE.test(e164.slice(2));
  return true; // elsewhere we can't tell from the number; the operator can override with a whatsapp column
}

/** Display format: "+58 414 123 4567" (VE), "+39 351 123 4567" (IT mobile), otherwise "+<digits>". */
export function formatPhone(e164: string): string {
  if (e164.startsWith("58") && e164.length === 12) return `+58 ${e164.slice(2, 5)} ${e164.slice(5, 8)} ${e164.slice(8)}`;
  if (e164.startsWith("39") && e164.length === 12) return `+39 ${e164.slice(2, 5)} ${e164.slice(5, 8)} ${e164.slice(8)}`;
  return `+${e164}`;
}
