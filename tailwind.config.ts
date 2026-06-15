import type { Config } from "tailwindcss";

/* ─────────────────────────────────────────────────────────────────
   PARKKAL TAILWIND CONFIGURATION
   Token spec: product/design/04_Parkkal_Tokens.md
   Brand system: product/design/02_Parkkal_Brand_System.md

   Architecture:
   - Ramp values (pk-teal, pk-gold, pk-neutral) are static hex —
     Tailwind generates utility classes from them.
   - Semantic aliases (pk-bg, pk-text, pk-accent, etc.) reference
     CSS variables from globals.css so they adapt to dark mode and
     tenant accent selection at runtime.
   ───────────────────────────────────────────────────────────────── */

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Teal ramp — locked brand primary ──────────────────────── */
        "pk-teal": {
          50:  "#E9F5F3",
          100: "#C7E6E2",
          200: "#93CEC8",
          300: "#5DB3AB",
          400: "#2F9189",
          500: "#137A72",
          600: "#0B6E6E",
          700: "#0B5654",
          800: "#0A413F",
          900: "#0D2B2B",
        },

        /* ── Gold ramp — default accent ──────────────────────────── */
        "pk-gold": {
          50:  "#FBF3E6",
          100: "#F5E1C0",
          200: "#EDC78A",
          300: "#E0AB5C",
          400: "#D2933F",
          500: "#C8873A",
          600: "#A86E2C",
          700: "#855520",
          800: "#5E3C16",
          900: "#3D270E",
        },

        /* ── Neutral ramp — warm enamel, never cold slate ─────────── */
        "pk-neutral": {
          0:   "#FFFFFF",
          50:  "#FAF8F3",
          100: "#F7F5F0",
          150: "#EFEBE2",
          200: "#E5E0D8",
          300: "#D4CEC2",
          400: "#B0A99B",
          500: "#847D6E",
          600: "#645D50",
          700: "#4A4439",
          800: "#322E26",
          900: "#1C1A15",
        },

        /* ── Semantic surfaces — CSS-variable driven ─────────────── */
        "pk-bg":             "var(--pk-bg)",
        "pk-surface":        "var(--pk-surface)",
        "pk-surface-raised": "var(--pk-surface-raised)",
        "pk-surface-sunken": "var(--pk-surface-sunken)",

        /* ── Semantic text ─────────────────────────────────────────── */
        "pk-text":           "var(--pk-text)",
        "pk-text-secondary": "var(--pk-text-secondary)",
        "pk-text-muted":     "var(--pk-text-muted)",

        /* ── Semantic borders ────────────────────────────────────── */
        "pk-border":        "var(--pk-border)",
        "pk-border-strong": "var(--pk-border-strong)",

        /* ── Brand action (locked) ───────────────────────────────── */
        "pk-primary":      "var(--pk-primary)",
        "pk-primary-text": "var(--pk-primary-text)",

        /* ── Accent (tenant-customizable — CSS var swaps at runtime) */
        "pk-accent":        "var(--pk-accent)",
        "pk-accent-action": "var(--pk-accent-action)",
        "pk-accent-tint":   "var(--pk-accent-tint)",

        /* ── Semantic status ─────────────────────────────────────── */
        "pk-success":             "var(--pk-success-solid)",
        "pk-success-fill":        "var(--pk-success-fill)",
        "pk-success-text":        "var(--pk-success-text)",
        "pk-success-border":      "var(--pk-success-border)",

        "pk-warning":             "var(--pk-warning-solid)",
        "pk-warning-fill":        "var(--pk-warning-fill)",
        "pk-warning-text":        "var(--pk-warning-text)",
        "pk-warning-border":      "var(--pk-warning-border)",

        "pk-danger":              "var(--pk-danger-solid)",
        "pk-danger-fill":         "var(--pk-danger-fill)",
        "pk-danger-text":         "var(--pk-danger-text)",
        "pk-danger-border":       "var(--pk-danger-border)",

        "pk-info":                "var(--pk-info-solid)",
        "pk-info-fill":           "var(--pk-info-fill)",
        "pk-info-text":           "var(--pk-info-text)",
        "pk-info-border":         "var(--pk-info-border)",

        /* ── Sidebar (locked) ────────────────────────────────────── */
        "pk-sidebar": "var(--pk-sidebar-bg)",
      },

      /* ── Font families ─────────────────────────────────────────── */
      fontFamily: {
        heading: ["Poppins", "-apple-system", "Segoe UI", "sans-serif"],
        body:    ["Inter",   "-apple-system", "Segoe UI", "sans-serif"],
        tamil:   ["Noto Sans Tamil", "Hind Madurai", "sans-serif"],
      },

      /* ── Type scale ────────────────────────────────────────────── */
      fontSize: {
        "pk-display":  ["2.5rem",    { lineHeight: "2.75rem",  fontWeight: "600", letterSpacing: "-0.02em" }],
        "pk-h1":       ["1.75rem",   { lineHeight: "2.125rem", fontWeight: "500", letterSpacing: "-0.01em" }],
        "pk-h2":       ["1.375rem",  { lineHeight: "1.75rem",  fontWeight: "500", letterSpacing: "-0.01em" }],
        "pk-h3":       ["1.125rem",  { lineHeight: "1.5rem",   fontWeight: "500", letterSpacing: "-0.005em" }],
        "pk-h4":       ["0.9375rem", { lineHeight: "1.25rem",  fontWeight: "600" }],
        "pk-body-lg":  ["1rem",      { lineHeight: "1.625rem" }],
        "pk-body":     ["0.875rem",  { lineHeight: "1.375rem" }],
        "pk-body-sm":  ["0.8125rem", { lineHeight: "1.25rem"  }],
        "pk-caption":  ["0.75rem",   { lineHeight: "1rem"     }],
        "pk-eyebrow":  ["0.6875rem", { lineHeight: "0.875rem", fontWeight: "600", letterSpacing: "0.06em" }],
      },

      /* ── Spacing (4px base unit) ──────────────────────────────── */
      spacing: {
        "pk-px":  "1px",
        "pk-0.5": "2px",
        "pk-1":   "4px",
        "pk-2":   "8px",
        "pk-3":   "12px",
        "pk-4":   "16px",
        "pk-5":   "20px",
        "pk-6":   "24px",
        "pk-8":   "32px",
        "pk-10":  "40px",
        "pk-12":  "48px",
        "pk-16":  "64px",
      },

      /* ── Radius ───────────────────────────────────────────────── */
      borderRadius: {
        "pk-xs":   "4px",
        "pk-sm":   "6px",
        "pk-md":   "10px",
        "pk-lg":   "14px",
        "pk-xl":   "20px",
        "pk-full": "9999px",
      },

      /* ── Elevation ────────────────────────────────────────────── */
      boxShadow: {
        "pk-e0":    "none",
        "pk-e1":    "0 1px 2px rgba(28,26,21,0.06)",
        "pk-e2":    "0 2px 8px rgba(28,26,21,0.08)",
        "pk-e3":    "0 8px 24px rgba(28,26,21,0.12)",
        "pk-focus": "0 0 0 3px rgba(11,110,110,0.20)",
      },

      /* ── Motion: durations ────────────────────────────────────── */
      transitionDuration: {
        "pk-instant":    "100ms",
        "pk-fast":       "150ms",
        "pk-base":       "200ms",
        "pk-slow":       "300ms",
        "pk-deliberate": "400ms",
      },

      /* ── Motion: easing ───────────────────────────────────────── */
      transitionTimingFunction: {
        "pk-out":    "cubic-bezier(0.2, 0, 0, 1)",
        "pk-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
        "pk-in":     "cubic-bezier(0.4, 0, 1, 1)",
      },

      /* ── Z-index scale ────────────────────────────────────────── */
      zIndex: {
        "pk-sidebar":  "40",
        "pk-header":   "50",
        "pk-dropdown": "100",
        "pk-modal":    "200",
        "pk-toast":    "300",
        "pk-tip":      "400",
      },

      /* ── Keyframes ────────────────────────────────────────────── */
      keyframes: {
        "pk-shimmer": {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "pk-arrival": {
          "0%":   { backgroundColor: "var(--pk-teal-50)" },
          "100%": { backgroundColor: "transparent" },
        },
      },

      animation: {
        "pk-shimmer": "pk-shimmer 1.2s ease-in-out infinite",
        "pk-arrival": "pk-arrival 300ms cubic-bezier(0.2,0,0,1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
