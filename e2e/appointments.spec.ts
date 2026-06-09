/**
 * E2E: Appointments module — list, create, navigation
 *
 * Uses shared admin auth session.
 */
import { test, expect } from "@playwright/test";

test.describe("Appointments page", () => {
  test("loads appointments list", async ({ page }) => {
    await page.goto("/dashboard/appointments");
    await expect(page.getByRole("heading", { name: /appointments/i })).toBeVisible({ timeout: 8_000 });
  });

  test("opens new appointment form", async ({ page }) => {
    await page.goto("/dashboard/appointments/new");
    // Date field must be visible
    await expect(page.getByLabel(/date/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("appointment list shows correct columns", async ({ page }) => {
    await page.goto("/dashboard/appointments");
    // Table header columns
    await expect(page.getByText(/patient/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/doctor/i).first()).toBeVisible();
  });
});
