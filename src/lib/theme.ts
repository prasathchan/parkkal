/**
 * lib/theme.ts
 *
 * Organisation-level theming. Under the Parkkal design system (Phase 2, Q11):
 *   - The CORE is locked: teal primary + teal-900 sidebar + enamel-ivory ground.
 *     These are NOT tenant-customizable and are owned by globals.css tokens.
 *   - The ACCENT is the one colour a clinic may change, chosen ONLY from the
 *     curated PARKKAL_ACCENT_SET (never a free hex picker — that would let blue
 *     or purple back in, which the brand forbids).
 *
 * Back-compat: `primaryColor` / `sidebarStyle` remain on the type for stored
 * configs and migration, but no longer drive `--primary` or the sidebar — the
 * core is locked. They are inert and slated for schema removal in a later pass.
 */
export type AccentName =
  | "Temple Gold"
  | "Clay Rose"
  | "Deep Saffron"
  | "Brass Olive"
  | "Terracotta"
  | "Teal Stone"
  | "Olive Gold";

export interface OrgThemeConfig {
  /** Curated accent — the only customizable brand colour. */
  accentName: AccentName;
  fontFamily: "system" | "inter" | "poppins";
  darkMode: "light" | "dark" | "system";
  /** @deprecated locked to teal — retained for stored-config back-compat only */
  primaryColor: string;
  /** @deprecated sidebar is locked teal-900 — retained for back-compat only */
  sidebarStyle: "dark" | "light" | "colored";
}

/** The locked brand teal — `--primary` is always this, regardless of tenant. */
export const PARKKAL_TEAL = "#0B6E6E";

export const DEFAULT_THEME: OrgThemeConfig = {
  accentName: "Temple Gold",
  fontFamily: "inter",
  darkMode: "light",
  primaryColor: PARKKAL_TEAL,
  sidebarStyle: "dark",
};

/**
 * The complete, locked accent set (Brand System §2.2.1). Each accent ships two
 * action tokens: `value` (500, identity fill / dark text) and `action` (600,
 * solid CTA surface with white text, all AA-validated ≥4.5:1).
 * Exposed as COLOR_PRESETS for the settings picker — clinics select ONLY from here.
 */
export const PARKKAL_ACCENT_SET = [
  { name: "Temple Gold", value: "#C8873A", action: "#A86E2C" },
  { name: "Clay Rose", value: "#B55D63", action: "#994B50" },
  { name: "Deep Saffron", value: "#C86A16", action: "#A85511" },
  { name: "Brass Olive", value: "#7B7A39", action: "#66652F" },
  { name: "Terracotta", value: "#B35B43", action: "#964A37" },
  { name: "Teal Stone", value: "#2F7D78", action: "#276762" },
  { name: "Olive Gold", value: "#B68B2E", action: "#8F6B23" },
] as const;

/** Curated accent swatches for the settings UI (no free hex picker). */
export const COLOR_PRESETS = PARKKAL_ACCENT_SET.map((a) => ({ name: a.name, value: a.value }));

export const FONT_OPTIONS = [
  { label: "Inter", value: "inter", stack: '"Inter",system-ui,sans-serif' },
  { label: "Poppins", value: "poppins", stack: '"Poppins",system-ui,sans-serif' },
  { label: "System Default", value: "system", stack: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' },
] as const;

export function parseThemeConfig(raw: string | null | undefined): OrgThemeConfig {
  if (!raw) return DEFAULT_THEME;
  try {
    const parsed = JSON.parse(raw) as Partial<OrgThemeConfig> & { primaryColor?: string };
    const merged = { ...DEFAULT_THEME, ...parsed };
    // Migrate legacy configs that have a primaryColor but no accentName:
    // map the stored colour to the nearest curated accent.
    if (!parsed.accentName && parsed.primaryColor) {
      merged.accentName = nearestAccent(parsed.primaryColor);
    }
    return merged;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Resolve an accent's `{value, action}` by name (falls back to Temple Gold). */
export function getAccent(name: AccentName) {
  return PARKKAL_ACCENT_SET.find((a) => a.name === name) ?? PARKKAL_ACCENT_SET[0];
}

/** CSS-variable overrides to inject for the chosen tenant accent. */
export function getAccentCssVars(name: AccentName): Record<string, string> {
  const accent = getAccent(name);
  return {
    "--pk-accent": accent.value,
    "--pk-accent-action": accent.action,
    "--pk-accent-hover": darken(accent.action, 16),
  };
}

// Hex colour to slightly darkened shade for hover states
export function darken(hex: string, amount = 20): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Nearest curated accent to an arbitrary hex (for migrating legacy configs). */
function nearestAccent(hex: string): AccentName {
  const target = hexToRgb(hex);
  if (!target) return "Temple Gold";
  let best: AccentName = "Temple Gold";
  let bestDist = Infinity;
  for (const a of PARKKAL_ACCENT_SET) {
    const c = hexToRgb(a.value)!;
    const d = (c.r - target.r) ** 2 + (c.g - target.g) ** 2 + (c.b - target.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = a.name;
    }
  }
  return best;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: n >> 16, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Sidebar colours — LOCKED to the teal-900 brand ground regardless of any
 * stored sidebarStyle. The light/colored variants are retired (Brand §14).
 */
export function getSidebarColors(_theme?: OrgThemeConfig) {
  return {
    bg: "#0D2B2B",
    border: "#162626",
    text: "rgba(255,255,255,0.72)",
    textActive: "#ffffff",
    activeBg: "rgba(255,255,255,0.10)",
    hoverBg: "rgba(255,255,255,0.06)",
    divider: "rgba(255,255,255,0.10)",
    userText: "#ffffff",
    userSubText: "rgba(255,255,255,0.55)",
  };
}
