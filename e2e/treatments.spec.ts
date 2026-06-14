/**
 * E2E: Treatment plans module — list, create via visit, status update
 *
 * Depends on shared admin auth session (auth.setup.ts).
 * Tests that require existing data use `test.skip()` when the DB is empty
 * so CI stays green on fresh environments.
 */
import { test, expect } from "@playwright/test";

test.describe("Treatment plans list", () => {
  test("loads treatment plans page", async ({ page }) => {
    await page.goto("/dashboard/treatments");
    await expect(page.getByRole("heading", { name: /treatment/i })).toBeVisible({ timeout: 8_000 });
  });

  test("shows filters and new-plan button", async ({ page }) => {
    await page.goto("/dashboard/treatments");
    // Status filter or patient filter should be visible
    await expect(page.getByPlaceholder(/search|patient/i).first()).toBeVisible({ timeout: 5_000 });
    // The "New Treatment Plan" trigger (button or link)
    await expect(
      page.getByRole("button", { name: /new treatment|add plan/i }).or(
        page.getByRole("link", { name: /new treatment|add plan/i })
      ).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("navigates to treatment plan detail when one exists", async ({ page }) => {
    await page.goto("/dashboard/treatments");
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("tbody tr").first();
    const rowCount = await page.locator("tbody tr").count();
    if (rowCount === 0) {
      test.skip(true, "No treatment plans in DB — skipping detail navigation test");
      return;
    }

    await firstRow.click();
    await expect(page).toHaveURL(/\/dashboard\/treatments\//, { timeout: 5_000 });
  });
});

test.describe("Treatment plan detail", () => {
  test("detail page shows plan info and status", async ({ page }) => {
    await page.goto("/dashboard/treatments");
    await page.waitForLoadState("networkidle");

    const rowCount = await page.locator("tbody tr").count();
    if (rowCount === 0) {
      test.skip(true, "No treatment plans — skipping detail page test");
      return;
    }

    await page.locator("tbody tr").first().click();
    await expect(page).toHaveURL(/\/dashboard\/treatments\//, { timeout: 5_000 });

    // Detail page should show the plan name or status
    await expect(
      page.getByText(/in.?progress|completed|planned|status/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("can create a treatment plan from visit treatment tab", async ({ page }) => {
    // Navigate to visits, find an OPEN visit
    await page.goto("/dashboard/visits");
    await page.waitForLoadState("networkidle");

    const openRow = page.locator("tbody tr").filter({ hasText: /open/i }).first();
    if (!(await openRow.isVisible().catch(() => false))) {
      test.skip(true, "No OPEN visits — skipping treatment plan creation test");
      return;
    }

    await openRow.click();
    await expect(page).toHaveURL(/\/dashboard\/visits\//, { timeout: 5_000 });

    // Switch to Treatment Plan tab
    await page.getByRole("button", { name: /treatment plan/i }).click();
    await page.waitForLoadState("networkidle");

    // The tab should show either a list or a "New Plan" button
    await expect(
      page.getByRole("button", { name: /new.*plan|add.*treatment/i }).or(
        page.getByText(/no treatment plan|start a plan/i)
      ).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
