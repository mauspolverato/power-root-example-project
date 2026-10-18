import { expandHex, hexToRgb, rgbToHex } from "../brand/extract.ts";

// WCAG contrast math. Every palette goes through `ensureReadable` so brand
// colors never produce text people can't read.

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function isHex(v: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Darken (or lighten) `fg` toward black (or white) until it reaches `min` contrast on `bg`. */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  let color = expandHex(fg);
  const target = luminance(bg) > 0.4 ? "#000000" : "#ffffff";
  for (let i = 0; i < 20 && contrast(color, bg) < min; i++) color = mix(color, target, 0.15);
  return color;
}

/** Best text color (near-black or white) to place on top of `bg`. */
export function onColor(bg: string): string {
  return contrast("#ffffff", bg) >= contrast("#111111", bg) ? "#ffffff" : "#111111";
}
