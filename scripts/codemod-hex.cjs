/* eslint-disable */
/**
 * codemod-hex.cjs — third pass: replace off-brand inline-style hex literals
 * (blue/purple/cold-slate/ad-hoc semantic) with Parkkal brand hexes. These live
 * in style={{...}} props (print pages, error pages) that the class-based codemod
 * and the lint ban-list can't see.
 *
 * Usage: node scripts/codemod-hex.cjs [--dry]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const DRY = process.argv.includes("--dry");

// lowercase off-brand hex → brand hex
const MAP = {
  // blue → teal
  "#2563eb": "#0B6E6E", "#3b82f6": "#0B6E6E", "#1d4ed8": "#0B5654",
  "#60a5fa": "#2F9189", "#1e40af": "#0A413F", "#172554": "#0D2B2B",
  // indigo/violet/purple → neutral/umber (decorative, de-emphasised)
  "#8b5cf6": "#645D50", "#7c3aed": "#4A4439", "#a855f7": "#645D50",
  "#6366f1": "#645D50", "#4f46e5": "#4A4439",
  // sky/cyan → teal stone
  "#0ea5e9": "#2F7D78", "#06b6d4": "#2F7D78", "#0891b2": "#276762",
  // cold slate/gray → warm neutral ramp
  "#0f172a": "#1C1A15", "#1e293b": "#1C1A15", "#334155": "#4A4439",
  "#475569": "#645D50", "#64748b": "#645D50", "#94a3b8": "#B0A99B",
  "#cbd5e1": "#D4CEC2", "#e2e8f0": "#E5E0D8", "#f1f5f9": "#EFEBE2",
  "#f8fafc": "#FAF8F3",
  // ad-hoc semantics → brand semantic
  "#ef4444": "#C0392B", "#dc2626": "#A8311F",
  "#22c55e": "#2E7D5B", "#16a34a": "#1E6E4B",
  "#eab308": "#C8873A", "#ca8a04": "#A86E2C",
  "#f97316": "#B35B43", "#ea580c": "#964A37",
  "#fbbf24": "#C8873A", "#d97706": "#9A5B0A",
};

const RE = new RegExp(Object.keys(MAP).join("|"), "gi");

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
  const out = src.replace(RE, (m) => MAP[m.toLowerCase()] ?? m);
  if (out !== src) {
    changed++;
    if (!DRY) fs.writeFileSync(f, out);
    console.log(`${DRY ? "[dry] " : ""}${path.relative(ROOT, f)}`);
  }
}
console.log(`\n${changed} files ${DRY ? "would change" : "changed"}.`);
