import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Phone photos are 3-8 MB each; on a Venezuelan mobile connection that is a
// page nobody waits for. Every local photo is resized and compressed into
// WebP variants (800/1600px) plus a JPEG fallback, with real dimensions so the
// layout doesn't jump while images load.

export interface SiteImage {
  src: string; // fallback (JPEG or remote URL)
  srcset?: string; // WebP variants
  width?: number;
  height?: number;
}

const WIDTHS = [800, 1600];

export async function processPhotos(photos: string[], siteDir: string): Promise<SiteImage[]> {
  const out: SiteImage[] = [];
  const imgDir = path.join(siteDir, "img");
  for (const [i, photo] of photos.entries()) {
    if (/^https?:\/\//.test(photo)) {
      out.push({ src: photo });
      continue;
    }
    if (!existsSync(photo)) continue;
    mkdirSync(imgDir, { recursive: true });
    const base = `photo-${i + 1}`;
    // .rotate() applies the EXIF orientation phones write instead of rotating pixels.
    const source = sharp(photo).rotate();
    const meta = await source.metadata();
    const portrait = (meta.orientation ?? 1) >= 5;
    const srcW = (portrait ? meta.height : meta.width) ?? 1600;
    const srcH = (portrait ? meta.width : meta.height) ?? 1200;

    const variants: string[] = [];
    for (const w of WIDTHS) {
      const width = Math.min(w, srcW);
      await source.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(imgDir, `${base}-${w}.webp`));
      variants.push(`img/${base}-${w}.webp ${width}w`);
      if (width === srcW) break; // smaller originals don't need a bigger variant
    }
    const fallbackW = Math.min(1200, srcW);
    await source.clone().resize({ width: fallbackW, withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true }).toFile(path.join(imgDir, `${base}.jpg`));
    out.push({ src: `img/${base}.jpg`, srcset: variants.join(", "), width: fallbackW, height: Math.round((srcH / srcW) * fallbackW) });
  }
  return out;
}
