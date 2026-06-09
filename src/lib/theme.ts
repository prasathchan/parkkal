/**
 * lib/theme.ts
 *
 * Organisation-level theming — primary colour, font, dark mode, sidebar style.
 * Theme settings are stored as a JSON string in the organizations.themeConfig column.
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 *   1. Admin picks settings in the Org Settings page.
 *   2. They're saved as JSON: `serializeTheme(config)` → DB.
 *   3. At render time, `parseThemeConfig(raw)` reads and applies them.
 *   4. CSS variables are injected via a <style> tag in the layout.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   OrgThemeConfig      — the shape of the config object
 *   DEFAULT_THEME       — fallback when no theme is saved
 *   COLOR_PRESETS       — preset brand colours shown in the settings UI
 *   FONT_OPTIONS        — available font choices with CSS stack strings
 *   parseThemeConfig()  — DB JSON string → OrgThemeConfig (with defaults)
 *   darken(hex, amount) — darken a hex colour for hover states
 *   getSidebarColors()  — returns a set of CSS colour values for the sidebar
 *                         based on the current sidebarStyle setting
 */
export interface OrgThemeConfig {
  primaryColor: string;
  fontFamily: "system" | "inter" | "poppins" | "roboto" | "nunito";
  darkMode: "light" | "dark" | "system";
  sidebarStyle: "dark" | "light" | "colored";
}

export const DEFAULT_THEME: OrgThemeConfig = {
  primaryColor: "#2563eb",
  fontFamily: "system",
  darkMode: "light",
  sidebarStyle: "dark",
};

export const COLOR_PRESETS = [
  { name: "Blue", value: "#2563eb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Orange", value: "#ea580c" },
  { name: "Amber", value: "#d97706" },
  { name: "Teal", value: "#0d9488" },
  { name: "Green", value: "#16a34a" },
];

export const FONT_OPTIONS = [
  { label: "System Default", value: "system", stack: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' },
  { label: "Inter", value: "inter", stack: '"Inter",system-ui,sans-serif' },
  { label: "Poppins", value: "poppins", stack: '"Poppins",system-ui,sans-serif' },
  { label: "Roboto", value: "roboto", stack: '"Roboto",system-ui,sans-serif' },
  { label: "Nunito", value: "nunito", stack: '"Nunito",system-ui,sans-serif' },
] as const;

export function parseThemeConfig(raw: string | null | undefined): OrgThemeConfig {
  if (!raw) return DEFAULT_THEME;
  try {
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

// Hex color to slightly darkened shade for hover states
export function darken(hex: string, amount = 20): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function getSidebarColors(theme: OrgThemeConfig) {
  switch (theme.sidebarStyle) {
    case "light":
      return {
        bg: "#ffffff",
        border: "#e2e8f0",
        text: "#475569",
        textActive: theme.primaryColor,
        activeBg: `${theme.primaryColor}15`,
        hoverBg: "#f1f5f9",
        divider: "#e2e8f0",
        userText: "#0f172a",
        userSubText: "#64748b",
      };
    case "colored":
      return {
        bg: theme.primaryColor,
        border: darken(theme.primaryColor, 30),
        text: "rgba(255,255,255,0.8)",
        textActive: "#ffffff",
        activeBg: "rgba(0,0,0,0.2)",
        hoverBg: "rgba(0,0,0,0.1)",
        divider: "rgba(255,255,255,0.2)",
        userText: "#ffffff",
        userSubText: "rgba(255,255,255,0.7)",
      };
    default: // dark
      return {
        bg: "#0f172a",
        border: "#1e293b",
        text: "#cbd5e1",
        textActive: "#ffffff",
        activeBg: theme.primaryColor,
        hoverBg: "#1e293b",
        divider: "#334155",
        userText: "#ffffff",
        userSubText: "#94a3b8",
      };
  }
}
