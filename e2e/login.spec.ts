/**
 * E2E: Login / Auth flows
 *
 * These tests run WITHOUT the shared auth state (they test the login page itself).
 */
import { test, expect } from "@playwright/test";

// Override the shared auth state for this file — we're testing unauthenticated flows
test.use({ storageState: undefined });

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows login form with email and password fields", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
  });

  test("shows error for empty form submission", async ({ page }) => {
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    // Should show validation error, not navigate away
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.getByLabel(/email/i).fill("wrong@test.com");
    await page.getByLabel(/password/i).fill("WrongPass1");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    // Error message should appear
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5_000 });
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    const email    = process.env.E2E_ADMIN_EMAIL    ?? "admin@parkkal.test";
    const password = process.env.E2E_ADMIN_PASSWORD ?? "Admin1234";
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
