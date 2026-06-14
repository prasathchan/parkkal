/* eslint-disable */
/**
 * regen-brand-icons.cjs — regenerates the Parkkal mark-only SVG + icon export set.
 *
 * Source: /brand/parkkal-tagline.svg (the Tamil ற-tooth + tagline lockup).
 * The mark-only PNGs were lost in a folder reorg, so we re-derive the mark by
 * cropping the ற-tooth above the tagline rule, squaring it, and vectorising.
 *
 * Outputs (all in /brand):
 *   parkkal-mark.svg                 ← Tamil ற-tooth, mark only, currentColor
 *   favicon-{16,32,48}.png           ← white mark on teal-900
 *   favicon.ico                      ← PNG-in-ICO (16/32/48)
 *   apple-touch-icon-180.png         ← white mark on teal-900, 62% safe area
 *   icon-maskable-{192,512}.png      ← white mark on teal-900, generous safe zone
 *   app-icon-1024-teal.png           ← white mark on teal-900
 *   app-icon-1024-ink.png            ← ink mark on enamel ivory
 *
 * Run from the app dir (sharp lives here):
 *   node --max-old-space-size=2048 scripts/regen-brand-icons.cjs
 */
const sharp = require("sharp");
const fs = require("fs");
const { execFileSync } = require("child_process");

const BRAND = "/Users/prasathchan/Documents/parkkal/brand";
const TMP = "/tmp/pk-icons";
const TEAL = { r: 0x0d, g: 0x2b, b: 0x2b }; // #0D2B2B teal-900
const IVORY = { r: 0xf7, g: 0xf5, b: 0xf0 }; // #F7F5F0 enamel
const INK = "#1C1A15";

fs.mkdirSync(TMP, { recursive: true });

async function main() {
  const taglineSvg = fs.readFileSync(`${BRAND}/parkkal-tagline.svg`);

  // 1 — render the lockup at high resolution for a clean trace source
  const full = sharp(Buffer.from(taglineSvg), { density: 200 });
  const meta = await full.metadata();
  const W = meta.width, H = meta.height;
  console.log(`lockup rendered ${W}x${H}`);

  // 2 — crop the mark: keep the top 88% (ற-tooth + roots), drop rule + tagline,
  //     trim to tight bbox, downscale to a sane trace size, write PNG temp
  const cropH = Math.round(H * 0.88);
  const trimmedPng = `${TMP}/mark-trimmed.png`;
  const trimInfo = await sharp(Buffer.from(taglineSvg), { density: 200 })
    .extract({ left: 0, top: 0, width: W, height: cropH })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .trim({ threshold: 10 })
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .png()
    .toFile(trimmedPng);

  const mw = trimInfo.width, mh = trimInfo.height;
  console.log(`mark trimmed + scaled to ${mw}x${mh}`);

  // 3 — pad to a centered square on white (trace source)
  const side = Math.max(mw, mh);
  const squarePng = `${TMP}/mark-square.png`;
  await sharp(trimmedPng)
    .extend({
      top: Math.floor((side - mh) / 2),
      bottom: Math.ceil((side - mh) / 2),
      left: Math.floor((side - mw) / 2),
      right: Math.ceil((side - mw) / 2),
      background: "#ffffff",
    })
    .png()
    .toFile(squarePng);
  console.log(`squared mark ${side}x${side} -> ${squarePng}`);

  // 5 — PGM (P5) for potrace (traces dark-on-light; mark is black on white)
  const { data: gray, info } = await sharp(squarePng)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pgm = `${TMP}/mark.pgm`;
  const header = Buffer.from(`P5\n${info.width} ${info.height}\n255\n`, "ascii");
  fs.writeFileSync(pgm, Buffer.concat([header, Buffer.from(gray)]));

  // 6 — potrace -> svg, then clean to currentColor schema
  const rawSvg = `${TMP}/mark-raw.svg`;
  execFileSync("potrace", [pgm, "-s", "-o", rawSvg, "--turdsize", "8", "--alphamax", "1", "--opttolerance", "0.2"]);
  let svg = fs.readFileSync(rawSvg, "utf8");
  svg = svg
    .replace(/<\?xml[\s\S]*?\?>\s*/i, "")
    .replace(/<!DOCTYPE[\s\S]*?>\s*/i, "")
    .replace(/<metadata>[\s\S]*?<\/metadata>\s*/i, "")
    .replace(/fill="#000000"/gi, 'fill="currentColor"')
    .replace(/<svg /, '<svg role="img" aria-label="Parkkal — ற-tooth mark" ');
  if (!/fill="currentColor"/.test(svg)) {
    svg = svg.replace(/<g /, '<g fill="currentColor" ');
  }
  if (!/<title>/.test(svg)) {
    svg = svg.replace(/(<svg[^>]*>)/, '$1\n<title>Parkkal — ற-tooth mark</title>');
  }
  fs.writeFileSync(`${BRAND}/parkkal-mark.svg`, svg);
  console.log(`wrote parkkal-mark.svg (${svg.length} bytes)`);

  // 7 — icon renderer: white-fill (or ink) mark centered on a colored square
  const markWhite = svg.replace(/currentColor/g, "#ffffff");
  const markInk = svg.replace(/currentColor/g, INK);

  async function icon(outName, size, bg, markSvg, safe = 0.7) {
    const inner = Math.round(size * safe);
    const markBuf = await sharp(Buffer.from(markSvg), { density: 96, limitInputPixels: false })
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: { ...bg, alpha: 1 } },
    })
      .composite([{ input: markBuf, gravity: "center" }])
      .png()
      .toFile(`${BRAND}/${outName}`);
    console.log(`  ${outName} ${size}px`);
  }

  // favicons — small, tighter safe area so the mark reads at 16px
  await icon("favicon-16.png", 16, TEAL, markWhite, 0.82);
  await icon("favicon-32.png", 32, TEAL, markWhite, 0.82);
  await icon("favicon-48.png", 48, TEAL, markWhite, 0.82);
  // apple touch — no transparency, 62% safe area per logo guidelines
  await icon("apple-touch-icon-180.png", 180, TEAL, markWhite, 0.62);
  // maskable — generous safe zone (mark within inner 62%, OS may crop edges)
  await icon("icon-maskable-192.png", 192, TEAL, markWhite, 0.62);
  await icon("icon-maskable-512.png", 512, TEAL, markWhite, 0.62);
  // app icons — full 1024
  await icon("app-icon-1024-teal.png", 1024, TEAL, markWhite, 0.66);
  await icon("app-icon-1024-ink.png", 1024, IVORY, markInk, 0.66);

  // 8 — favicon.ico (PNG-in-ICO: 16, 32, 48)
  await buildIco(
    [16, 32, 48].map((s) => `${BRAND}/favicon-${s}.png`),
    `${BRAND}/favicon.ico`
  );
  console.log("wrote favicon.ico");
}

/** Pack PNG files into a single PNG-in-ICO container (no external deps). */
async function buildIco(pngPaths, outPath) {
  const imgs = await Promise.all(
    pngPaths.map(async (p) => {
      const buf = fs.readFileSync(p);
      const meta = await sharp(buf).metadata();
      return { buf, size: meta.width };
    })
  );
  const count = imgs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const bodies = [];
  imgs.forEach((img, i) => {
    const b = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 0); // width
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 1); // height
    dir.writeUInt8(0, b + 2); // palette
    dir.writeUInt8(0, b + 3); // reserved
    dir.writeUInt16LE(1, b + 4); // color planes
    dir.writeUInt16LE(32, b + 6); // bpp
    dir.writeUInt32LE(img.buf.length, b + 8); // size
    dir.writeUInt32LE(offset, b + 12); // offset
    offset += img.buf.length;
    bodies.push(img.buf);
  });
  fs.writeFileSync(outPath, Buffer.concat([header, dir, ...bodies]));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
