import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * Run locally:  npx playwright test
 * Run headed:   npx playwright test --headed
 * Run single:   npx playwright test e2e/login.spec.ts
 * Debug:        npx playwright test --debug
 * View report:  npx playwright show-report
 *
 * Requires the dev server to be running on localhost:3000.
 * Use `npm run dev` in a separate terminal, or use webServer below.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,     // clinic app has auth state — run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Clinic-specific: most actions require an authenticated session
    storageState: "e2e/.auth/session.json",
  },

  projects: [
    // ── Setup project: logs in and saves auth state ─────────────────────────
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { storageState: undefined },   // no pre-existing auth for setup
    },
    // ── Main test run: re-uses saved auth state ──────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  // Start dev server automatically during E2E runs
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
