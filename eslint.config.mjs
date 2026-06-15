import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Parkkal design-system guardrail: forbidden Tailwind colour classes.
// No blue/purple (Brand §17) and no cold neutrals (slate/gray/zinc) — use the
// warm pk-* tokens instead (product/design/04_Parkkal_Tokens.md).
// `warn` for now; flip to `error` once the tree is confirmed clean (guide §6).
const BANNED_COLOR =
  "(?:bg|text|border|ring|divide|from|via|to|placeholder|fill|stroke|outline|caret|accent|decoration)-(?:blue|indigo|sky|cyan|violet|purple|fuchsia|slate|gray|zinc)-\\d";
const BANNED_MSG =
  "Forbidden colour class — use the warm pk-* design tokens (no blue/purple/slate/gray). See product/design/04_Parkkal_Tokens.md.";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow unused variables when prefixed with _ (intentional no-ops, destructuring)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-syntax": [
        "warn",
        { selector: `Literal[value=/${BANNED_COLOR}/]`, message: BANNED_MSG },
        { selector: `TemplateElement[value.cooked=/${BANNED_COLOR}/]`, message: BANNED_MSG },
      ],
    },
  },
];

export default eslintConfig;
