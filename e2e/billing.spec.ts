/**
 * E2E: Billing + Reports — critical revenue paths
 *
 * Uses shared admin auth session.
 */
import { test, expect } from "@playwright/test";

test.describe("Billing page", () => {
  test("loads billing list", async ({ page }) => {
    await page.goto("/dashboard/billing");
    await expect(page.getByRole("heading", { name: /billing|visits/i })).toBeVisible({ timeout: 8_000 });
  });

  test("shows billing status filters", async ({ page }) => {
    await page.goto("/dashboard/billing");
    // Filter controls should be visible
    await expect(
      page.locator("select, [role='combobox'], input[type='search'], input[type='text']").first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Reports page", () => {
  test("loads reports dashboard", async ({ page }) => {
    await page.goto("/dashboard/reports");
    await expect(page.getByRole("heading", { name: /reports|business/i })).toBeVisible({ timeout: 10_000 });
  });

  test("period selector toggles between 30d / 90d / 365d", async ({ page }) => {
    await page.goto("/dashboard/reports");
    // Wait for data to load first
    await page.waitForTimeout(1_000);
    // Click 90 days
    await page.getByRole("button", { name: /90 days/i }).click();
    // Page should still be on reports URL
    await expect(page).toHaveURL(/\/dashboard\/reports/);
    // Summary cards should re-render (not crash)
    await expect(page.locator("text=/billed|collected|patients/i").first()).toBeVisible({ timeout: 8_000 });
  });

  test("all summary stat cards are rendered", async ({ page }) => {
    await page.goto("/dashboard/reports");
    await page.waitForTimeout(1_500);
    // Expect at least 4 stat cards
    const cards = await page.locator(".bg-white.rounded-xl").count();
    expect(cards).toBeGreaterThanOrEqual(4);
  });
});

test.describe("Navigation", () => {
  test("sidebar links are all reachable without 404", async ({ page }) => {
    const pages = [
      "/dashboard",
      "/dashboard/patients",
      "/dashboard/appointments",
      "/dashboard/visits",
      "/dashboard/treatments",
      "/dashboard/billing",
      "/dashboard/reports",
      "/dashboard/staff",
    ];
    for (const url of pages) {
      const res = await page.goto(url);
      expect(res?.status(), `Expected 200 for ${url}`).toBe(200);
    }
  });
});
