// Generates every UniHop brand asset from public/brand/logo-source.png. Reproducible:
//
//   npm run brand-assets
//
// The logo is never redrawn: every output is the source's own pixels, cropped, made transparent
// where the source is plain white background, scaled, or composited onto the logo's navy.
//
// Outputs (public/brand/ unless noted):
//   icon.png                1024  rounded square, transparent outside it
//   icon-192.png, icon-512.png    PWA icons (transparent corners)
//   apple-touch-icon.png    180   flattened on solid navy (iOS masks it itself)
//   icon-maskable-512.png   512   navy background, artwork inside the 80% safe-zone circle
//   mark.png, mark@2x.png   512 / 1024  pin + cap + road on transparent (white artwork: dark surfaces only)
//   src/app/favicon.ico     16, 32, 48 (PNG-in-ICO), picked up by Next's file convention
//   screenshots/brand-preview-*.png  extraction previews on navy / dark / white (gitignored)
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const BRAND = join(ROOT, "public", "brand");
const SOURCE = join(BRAND, "logo-source.png");
const PREVIEW = join(ROOT, "screenshots");

/** Logo colors sampled from the source (DESIGN.md: navy #002E73, orange #FE6531). */
const NAVY: RGB = [0, 46, 115];
const WHITE: RGB = [255, 255, 255];
const ORANGE: RGB = [254, 101, 49];
const NAVY_BG = { r: 0, g: 46, b: 115, alpha: 1 };
const NOISE_FLOOR = 0.06;

type RGB = [number, number, number];

interface Raster {
  data: Buffer; // RGBA
  width: number;
  height: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Fraction a in [0,1] such that P ~= N + a(F - N), and the leftover distance from that line. */
function project(p: RGB, n: RGB, f: RGB): { a: number; residual: number } {
  const d = [f[0] - n[0], f[1] - n[1], f[2] - n[2]];
  const v = [p[0] - n[0], p[1] - n[1], p[2] - n[2]];
  const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const a = clamp01((v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / len2);
  const r = [v[0] - a * d[0], v[1] - a * d[1], v[2] - a * d[2]];
  return { a, residual: Math.hypot(r[0], r[1], r[2]) };
}

async function loadSource(): Promise<Raster> {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Tight bounding box of everything that isn't plain white background. */
function contentBox(src: Raster) {
  let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (src.data[i] + src.data[i + 1] + src.data[i + 2] < 600) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function crop(src: Raster, box: { left: number; top: number; width: number; height: number }): Raster {
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    src.data.copy(out, y * box.width * 4, ((box.top + y) * src.width + box.left) * 4, ((box.top + y) * src.width + box.left + box.width) * 4);
  }
  return { data: out, width: box.width, height: box.height };
}

/**
 * Marks the white background outside the rounded square: flood-fill from the crop's edges through
 * anything that isn't solid navy. The square's straight edges are solid navy, so only the four
 * corner regions are reached; the white artwork inside the square is never touched.
 */
function outsideMask(img: Raster): Uint8Array {
  const { width: w, height: h, data } = img;
  const outside = new Uint8Array(w * h);
  const navyness = (i: number) => 1 - project([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]], NAVY, WHITE).a;
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const k = y * w + x;
    if (!outside[k] && navyness(k) < 0.97) {
      outside[k] = 1;
      stack.push(k);
    }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w, y = (k / w) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  return outside;
}

/** Rounded square with the outside made transparent; edge pixels keep their navy share as alpha. */
function iconFrom(img: Raster, outside: Uint8Array): Raster {
  const out = Buffer.from(img.data);
  for (let k = 0; k < img.width * img.height; k++) {
    if (!outside[k]) continue;
    const i = k * 4;
    const a = 1 - project([img.data[i], img.data[i + 1], img.data[i + 2]], NAVY, WHITE).a;
    out[i] = NAVY[0]; out[i + 1] = NAVY[1]; out[i + 2] = NAVY[2];
    out[i + 3] = Math.round(a * 255);
  }
  return { ...img, data: out };
}

/**
 * The artwork without its navy: each pixel is unmixed against navy toward whichever foreground
 * (white or orange) explains it best. Alpha is that foreground share; color is recovered exactly
 * as (P - (1 - a) * NAVY) / a, so white/orange boundaries keep their original blend.
 */
function markFrom(img: Raster, outside: Uint8Array): Raster {
  const out = Buffer.alloc(img.data.length);
  for (let k = 0; k < img.width * img.height; k++) {
    if (outside[k]) continue;
    const i = k * 4;
    const p: RGB = [img.data[i], img.data[i + 1], img.data[i + 2]];
    const w = project(p, NAVY, WHITE);
    const o = project(p, NAVY, ORANGE);
    // Noise floor: the navy field and the square's anti-aliased rim carry a few percent of
    // "foreground" that isn't artwork. Treat it as navy and stretch the rest back to 0..1.
    const raw = w.residual <= o.residual ? w.a : o.a;
    const stretched = clamp01((raw - NOISE_FLOOR) / (1 - NOISE_FLOOR));
    // The source's "white" is #FEFEFE; snap near-solid artwork to fully opaque.
    const a = stretched >= 0.97 ? 1 : stretched;
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(Math.min(255, Math.max(0, (p[c] - (1 - a) * NAVY[c]) / a)));
    out[i + 3] = Math.round(a * 255);
  }
  return { ...img, data: out };
}

function alphaBox(img: Raster, min = 8) {
  let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > min) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Farthest visible pixel from the artwork's center, in source px (for the maskable safe zone). */
function maxRadius(img: Raster) {
  const b = alphaBox(img, 64);
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  let r = 0;
  for (let y = b.top; y < b.top + b.height; y++) {
    for (let x = b.left; x < b.left + b.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 64) r = Math.max(r, Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
    }
  }
  return { r, box: b };
}

const toSharp = (img: Raster) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } });

/** Square PNG at `size`, artwork contained and centered on a transparent canvas. */
async function squarePng(img: Raster, size: number): Promise<Buffer> {
  return toSharp(img)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(pngs: Array<{ size: number; data: Buffer }>): Buffer {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((p, n) => {
    const e = 6 + n * 16;
    header.writeUInt8(p.size >= 256 ? 0 : p.size, e);
    header.writeUInt8(p.size >= 256 ? 0 : p.size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(p.data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += p.data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

async function main() {
  mkdirSync(PREVIEW, { recursive: true });
  const src = await loadSource();
  const square = crop(src, contentBox(src));
  const outside = outsideMask(square);
  console.log(`source ${src.width}x${src.height}, rounded square ${square.width}x${square.height}`);

  // 1. icon.png 1024 + PWA sizes
  const icon = iconFrom(square, outside);
  const iconPng = await squarePng(icon, 1024);
  writeFileSync(join(BRAND, "icon.png"), iconPng);
  for (const size of [192, 512]) writeFileSync(join(BRAND, `icon-${size}.png`), await sharp(iconPng).resize(size, size, { kernel: "lanczos3" }).png().toBuffer());

  // 2. apple-touch-icon: solid navy, no transparency
  writeFileSync(
    join(BRAND, "apple-touch-icon.png"),
    await sharp(iconPng).resize(180, 180, { kernel: "lanczos3" }).flatten({ background: NAVY_BG }).removeAlpha().png().toBuffer(),
  );

  // 3. favicon.ico (16, 32, 48)
  const fav = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await sharp(iconPng).resize(size, size, { kernel: "lanczos3" }).png().toBuffer() })));
  writeFileSync(join(ROOT, "src", "app", "favicon.ico"), ico(fav));

  // 4. mark: artwork on transparent, tightly trimmed, contained in a square
  const markFull = markFrom(square, outside);
  const mark = crop(markFull, alphaBox(markFull, 32));
  writeFileSync(join(BRAND, "mark.png"), await squarePng(mark, 512));
  writeFileSync(join(BRAND, "mark@2x.png"), await squarePng(mark, 1024));

  // 5. maskable: navy background, artwork scaled so its farthest pixel sits inside the 80% circle
  const { r } = maxRadius(markFull);
  const safeRadius = 512 * 0.4 * 0.96;
  const markSize = Math.round((Math.max(mark.width, mark.height) * safeRadius) / r);
  const markForMask = await toSharp(mark).resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" }).png().toBuffer();
  writeFileSync(
    join(BRAND, "icon-maskable-512.png"),
    await sharp({ create: { width: 512, height: 512, channels: 4, background: NAVY_BG } })
      .composite([{ input: markForMask, gravity: "center" }])
      .flatten({ background: NAVY_BG })
      .removeAlpha()
      .png()
      .toBuffer(),
  );

  // 6. extraction previews: on navy (should match the source), on the dark app bg, on white
  const markPng = await squarePng(mark, 512);
  for (const [name, bg] of [["navy", NAVY_BG], ["dark", { r: 10, g: 18, b: 34, alpha: 1 }], ["white", { r: 255, g: 255, b: 255, alpha: 1 }]] as const) {
    await sharp({ create: { width: 640, height: 640, channels: 4, background: bg } })
      .composite([{ input: markPng, gravity: "center" }])
      .png()
      .toFile(join(PREVIEW, `brand-preview-mark-on-${name}.png`));
  }
  // Edge close-up: 4x nearest-neighbour crop of the road and pin edge on the dark bg.
  await sharp(join(PREVIEW, "brand-preview-mark-on-dark.png"))
    .extract({ left: 250, top: 330, width: 160, height: 160 })
    .resize(640, 640, { kernel: "nearest" })
    .toFile(join(PREVIEW, "brand-preview-mark-edges-4x.png"));

  console.log(`mark artwork ${mark.width}x${mark.height}, maskable artwork ${markSize}px (safe radius ${safeRadius.toFixed(0)}px)`);
  console.log("wrote public/brand/{icon,icon-192,icon-512,apple-touch-icon,icon-maskable-512,mark,mark@2x}.png and src/app/favicon.ico");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
