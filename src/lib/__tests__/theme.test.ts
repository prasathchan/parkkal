/**
 * Tests for src/lib/theme.ts
 *
 * Covers: parseThemeConfig, darken, getSidebarColors, DEFAULT_THEME
 */
import { describe, it, expect } from "vitest";
import { parseThemeConfig, darken, getSidebarColors, DEFAULT_THEME, COLOR_PRESETS } from "@/lib/theme";

// ─── parseThemeConfig ────────────────────────────────────────────────────────

describe("parseThemeConfig", () => {
  it("returns DEFAULT_THEME for null", () => {
    expect(parseThemeConfig(null)).toEqual(DEFAULT_THEME);
  });

  it("returns DEFAULT_THEME for undefined", () => {
    expect(parseThemeConfig(undefined)).toEqual(DEFAULT_THEME);
  });

  it("returns DEFAULT_THEME for empty string", () => {
    expect(parseThemeConfig("")).toEqual(DEFAULT_THEME);
  });

  it("returns DEFAULT_THEME for malformed JSON", () => {
    expect(parseThemeConfig("{not-valid-json}")).toEqual(DEFAULT_THEME);
  });

  it("parses valid JSON and merges with defaults", () => {
    const config = JSON.stringify({ primaryColor: "#e11d48" });
    const result = parseThemeConfig(config);
    expect(result.primaryColor).toBe("#e11d48");
    // Other fields stay at defaults
    expect(result.fontFamily).toBe(DEFAULT_THEME.fontFamily);
    expect(result.darkMode).toBe(DEFAULT_THEME.darkMode);
  });

  it("full override: provided fields are retained and merged with defaults", () => {
    const custom = {
      primaryColor: "#7c3aed",
      fontFamily: "poppins" as const,
      darkMode: "dark" as const,
      sidebarStyle: "light" as const,
    };
    const result = parseThemeConfig(JSON.stringify(custom));
    expect(result.primaryColor).toBe("#7c3aed");
    expect(result.fontFamily).toBe("poppins");
    expect(result.darkMode).toBe("dark");
    // A stored config without accentName is migrated to the nearest curated accent.
    expect(result.accentName).toBeTruthy();
  });
});

// ─── DEFAULT_THEME ────────────────────────────────────────────────────────────

describe("DEFAULT_THEME", () => {
  it("has a valid hex primaryColor", () => {
    expect(DEFAULT_THEME.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("uses dark sidebar by default", () => {
    expect(DEFAULT_THEME.sidebarStyle).toBe("dark");
  });

  it("uses light mode by default", () => {
    expect(DEFAULT_THEME.darkMode).toBe("light");
  });
});

// ─── COLOR_PRESETS ────────────────────────────────────────────────────────────

describe("COLOR_PRESETS", () => {
  it("has at least 4 presets", () => {
    expect(COLOR_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it("all preset colors are valid hex", () => {
    for (const preset of COLOR_PRESETS) {
      expect(preset.value).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ─── darken ───────────────────────────────────────────────────────────────────

describe("darken", () => {
  it("darkens a hex color", () => {
    const original = "#2563eb"; // blue
    const darkened = darken(original, 20);
    // Darkened should be a valid hex string
    expect(darkened).toMatch(/^#[0-9a-fA-F]{6}$/);
    // And the resulting value should be numerically smaller (darker)
    const origNum = parseInt(original.slice(1), 16);
    const darkNum = parseInt(darkened.slice(1), 16);
    expect(darkNum).toBeLessThan(origNum);
  });

  it("clamps to #000000 at maximum darkness", () => {
    const result = darken("#000000", 100);
    expect(result).toBe("#000000");
  });

  it("does not produce values below 0 for any channel", () => {
    const result = darken("#010101", 10);
    expect(result).toBe("#000000");
  });
});

// ─── getSidebarColors ────────────────────────────────────────────────────────

describe("getSidebarColors", () => {
  it("is LOCKED to the teal-900 ground regardless of sidebarStyle", () => {
    // The light/colored variants are retired (Brand §14) — sidebar is always teal-900.
    const dark = getSidebarColors({ ...DEFAULT_THEME, sidebarStyle: "dark" });
    const light = getSidebarColors({ ...DEFAULT_THEME, sidebarStyle: "light" });
    const colored = getSidebarColors({ ...DEFAULT_THEME, sidebarStyle: "colored", primaryColor: "#e11d48" });
    expect(dark.bg).toBe("#0D2B2B");
    expect(light.bg).toBe("#0D2B2B");
    expect(colored.bg).toBe("#0D2B2B");
    expect(dark.textActive).toBe("#ffffff");
  });

  it("returns an object with all required color keys", () => {
    const colors = getSidebarColors(DEFAULT_THEME);
    const requiredKeys = ["bg", "border", "text", "textActive", "activeBg", "hoverBg", "divider", "userText", "userSubText"];
    for (const key of requiredKeys) {
      expect(colors).toHaveProperty(key);
    }
  });
});
