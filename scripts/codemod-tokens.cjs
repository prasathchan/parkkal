/* eslint-disable */
/**
 * codemod-tokens.cjs — big-bang colour migration to the Parkkal token system.
 *
 * - Neutrals (slate/gray/zinc/stone/neutral) → semantic aliases (pk-surface/text/
 *   border, which are CSS-var-backed and adapt to dark mode), or the warm
 *   pk-neutral ramp for dark/structural shades.
 * - Banned hues blue/indigo/sky/cyan → pk-teal ramp (info & primary are teal).
 * - Banned hues purple/violet/fuchsia → pk-neutral ramp (were decorative/secondary).
 * - Leaves green/red/amber/yellow/orange (semantic, not banned) for a later pass.
 * - Leaves bg-white/text-white (intentional), and any pk-* class (already migrated).
 *
 * Usage: node scripts/codemod-tokens.cjs [--dry]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const DRY = process.argv.includes("--dry");

const NEUTRALS = ["slate", "gray", "zinc", "stone", "neutral"];
const TEALISH = ["blue", "indigo", "sky", "cyan"];
const NEUTRALISH_BANNED = ["purple", "violet", "fuchsia"];

const clampShade = (s) => (Number(s) >= 950 ? "900" : s);

function mapNeutral(util, shade) {
  switch (util) {
    case "text":
      if (["900", "800"].includes(shade)) return "text-pk-text";
      if (["700", "600"].includes(shade)) return "text-pk-text-secondary";
      return "text-pk-text-muted"; // 500..50
    case "bg":
      if (shade === "50") return "bg-pk-surface-raised";
      if (["100", "150", "200"].includes(shade)) return "bg-pk-surface-sunken";
      return `bg-pk-neutral-${clampShade(shade)}`; // 300..900 structural/dark
    case "border":
      if (["300", "400"].includes(shade)) return "border-pk-border-strong";
      return "border-pk-border";
    case "divide":
      return "divide-pk-border";
    case "placeholder":
      return "placeholder-pk-text-muted";
    case "ring":
      return "ring-pk-border";
    default:
      return `${util}-pk-neutral-${clampShade(shade)}`;
  }
}

function mapTo(util, shade, ramp) {
  return `${util}-pk-${ramp}-${clampShade(shade)}`;
}

const UTILS = "bg|text|border|ring|divide|placeholder|from|via|to|fill|stroke|caret|accent|outline|decoration";
const COLORS = [...NEUTRALS, ...TEALISH, ...NEUTRALISH_BANNED].join("|");
// (variant:)* utility - color - shade (optional /opacity)
const RE = new RegExp(
  `((?:[a-z][a-z0-9-]*:)*)(${UTILS})-(${COLORS})-(\\d{2,3})(\\/\\d{1,3})?`,
  "g"
);

function convert(src) {
  return src.replace(RE, (m, prefix, util, color, shade, opacity) => {
    prefix = prefix || "";
    let out;
    if (NEUTRALS.includes(color)) out = mapNeutral(util, shade);
    else if (TEALISH.includes(color)) out = mapTo(util, shade, "teal");
    else out = mapTo(util, shade, "neutral"); // purple/violet/fuchsia
    // re-attach opacity only for ramp classes (aliases don't take a shade slash)
    const isRamp = /-pk-(teal|neutral)-\d/.test(out);
    return prefix + out + (opacity && isRamp ? opacity : "");
  });
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      walk(p);
    } else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
})(ROOT);

let changed = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const out = convert(src);
  if (out !== src) {
    changed++;
    if (!DRY) fs.writeFileSync(f, out);
    console.log(`${DRY ? "[dry] " : ""}${path.relative(ROOT, f)}`);
  }
}
console.log(`\n${changed} files ${DRY ? "would change" : "changed"} (of ${files.length}).`);
