/* eslint-disable */
/**
 * codemod-bgwhite.cjs — fix the dark-mode regression.
 *
 * Bare `bg-white` is a FIXED white that does not adapt to dark mode, so cards
 * kept white while text-pk-text went near-white → invisible text in dark mode.
 * Map `bg-white` → `bg-pk-surface` (adapts: white in light, #1B2A28 in dark).
 *
 * Preserves translucent overlays like `bg-white/10` (intentional on teal grounds)
 * and `text-white`/`border-white` (correct on coloured surfaces).
 *
 * Usage: node scripts/codemod-bgwhite.cjs [--dry]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const DRY = process.argv.includes("--dry");

// bg-white (with optional variant prefix) NOT followed by "/" (opacity) — keep bg-white/10
const RE = /\bbg-white\b(?!\/)/g;

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

let changed = 0, hits = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const m = src.match(RE);
  if (!m) continue;
  hits += m.length;
  const out = src.replace(RE, "bg-pk-surface");
  if (out !== src) {
    changed++;
    if (!DRY) fs.writeFileSync(f, out);
  }
}
console.log(`${changed} files, ${hits} occurrences ${DRY ? "would change" : "changed"}.`);
