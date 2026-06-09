/**
 * E2E Setup: Authenticate as admin and save session state.
 *
 * This runs ONCE before all E2E tests. It logs in with test credentials,
 * saves the browser storage (cookies) to e2e/.auth/session.json, and
 * subsequent tests re-use that session — no re-login needed per test.
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. Local DB seeded with test admin: node scripts/setup-local-db.js
 *   3. Test credentials set in env (or defaults below for local dev only)
 */
import { test as setup, expect } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_ADMIN_EMAIL    ?? "admin@parkkal.test";
const E2E_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin1234";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  // Fill credentials
  await page.getByLabel(/email/i).fill(E2E_EMAIL);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Should arrive at dashboard (direct login when single org)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  // Save auth state (cookies) for all subsequent tests
  await page.context().storageState({ path: "e2e/.auth/session.json" });
});
