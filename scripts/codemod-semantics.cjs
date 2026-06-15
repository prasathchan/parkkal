/* eslint-disable */
/**
 * codemod-semantics.cjs — second pass: map ad-hoc semantic Tailwind colours to
 * the Parkkal role tokens (which are CSS-var-backed and adapt to dark mode).
 *
 *   green/emerald/lime  → pk-success-{fill,text,border} / pk-success (solid)
 *   red/rose            → pk-danger-...
 *   amber/yellow/orange → pk-warning-...
 *
 * Role by utility:  text-→ -text · border-/divide-→ -border ·
 *   bg- shade≤200 → -fill, else solid · ring-/fill-/stroke-/from-/to- → solid
 *
 * Usage: node scripts/codemod-semantics.cjs [--dry]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const DRY = process.argv.includes("--dry");

const GROUPS = {
  success: ["green", "emerald", "lime"],
  danger: ["red", "rose"],
  warning: ["amber", "yellow", "orange"],
};
const COLOR_TO_ROLE = {};
for (const [role, colors] of Object.entries(GROUPS)) for (const c of colors) COLOR_TO_ROLE[c] = role;

function mapSemantic(util, role, shade) {
  switch (util) {
    case "text":
      return `text-pk-${role}-text`;
    case "border":
      return `border-pk-${role}-border`;
    case "divide":
      return `divide-pk-${role}-border`;
    case "bg":
      return Number(shade) <= 200 ? `bg-pk-${role}-fill` : `bg-pk-${role}`;
    case "ring":
      return `ring-pk-${role}`;
    default:
      return `${util}-pk-${role}`; // fill/stroke/from/to/via on dots, svgs, gradients
  }
}

const UTILS = "bg|text|border|ring|divide|fill|stroke|from|via|to";
const COLORS = Object.keys(COLOR_TO_ROLE).join("|");
const RE = new RegExp(
  `((?:[a-z][a-z0-9-]*:)*)(${UTILS})-(${COLORS})-(\\d{2,3})(\\/\\d{1,3})?`,
  "g"
);

function convert(src) {
  return src.replace(RE, (m, prefix, util, color, shade) => {
    return (prefix || "") + mapSemantic(util, COLOR_TO_ROLE[color], shade);
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
  }
}
console.log(`${changed} files ${DRY ? "would change" : "changed"} (of ${files.length}).`);
