import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      JWT_SECRET: "test-jwt-secret-at-least-32-chars-long",
      ENCRYPTION_KEY: "0".repeat(64),
      RESEND_API_KEY: "re_test_key",
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      // Exclude UI pages, components, and generated/config files
      exclude: [
        "src/app/dashboard/**",
        "src/app/(auth)/**",
        "src/components/**",
        "src/app/layout.tsx",
        "src/app/page.tsx",
        "**/*.d.ts",
        "**/*.config.*",
        "src/db/schema.ts",
        "src/lib/__tests__/**",
      ],
      thresholds: {
        // Start at 40%; raise 5 pts per sprint as coverage grows
        statements: 40,
        branches:   35,
        functions:  40,
        lines:      40,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
