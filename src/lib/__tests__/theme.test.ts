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

  it("full override: all fields present", () => {
    const custom = {
      primaryColor: "#7c3aed",
      fontFamily: "poppins" as const,
      darkMode: "dark" as const,
      sidebarStyle: "light" as const,
    };
    const result = parseThemeConfig(JSON.stringify(custom));
    expect(result).toEqual(custom);
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
  it("returns dark-themed colors for sidebarStyle: dark", () => {
    const colors = getSidebarColors({ ...DEFAULT_THEME, sidebarStyle: "dark" });
    expect(colors.bg).toBe("#0f172a");
    expect(colors.textActive).toBe("#ffffff");
  });

  it("returns white background for sidebarStyle: light", () => {
    const colors = getSidebarColors({ ...DEFAULT_THEME, sidebarStyle: "light" });
    expect(colors.bg).toBe("#ffffff");
  });

  it("uses primaryColor as background for sidebarStyle: colored", () => {
    const primary = "#e11d48";
    const colors = getSidebarColors({ ...DEFAULT_THEME, sidebarStyle: "colored", primaryColor: primary });
    expect(colors.bg).toBe(primary);
  });

  it("returns an object with all required color keys", () => {
    const colors = getSidebarColors(DEFAULT_THEME);
    const requiredKeys = ["bg", "border", "text", "textActive", "activeBg", "hoverBg", "divider", "userText", "userSubText"];
    for (const key of requiredKeys) {
      expect(colors).toHaveProperty(key);
    }
  });
});
