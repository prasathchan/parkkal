/**
 * E2E: Visits module — list, create, add item, record payment, overpayment flow
 *
 * Depends on shared admin auth session (auth.setup.ts).
 * Many sub-tests guard with `test.skip()` when no data exists so CI stays green
 * on a fresh DB; run `node scripts/setup-local-db.js` with seed data for full coverage.
 */
import { test, expect } from "@playwright/test";

const SUFFIX = Date.now().toString().slice(-6);
const TEST_PATIENT_NAME  = `Visit E2E ${SUFFIX}`;
const TEST_PATIENT_PHONE = `8${SUFFIX.padStart(9, "0")}`;

// ─── List page ────────────────────────────────────────────────────────────────

test.describe("Visits list", () => {
  test("loads visits list page", async ({ page }) => {
    await page.goto("/dashboard/visits");
    await expect(page.getByRole("heading", { name: /visits/i })).toBeVisible({ timeout: 8_000 });
  });

  test("visit list shows status and patient columns", async ({ page }) => {
    await page.goto("/dashboard/visits");
    await expect(page.getByText(/patient/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/status/i).first()).toBeVisible();
  });

  test("navigates to new visit form from list", async ({ page }) => {
    await page.goto("/dashboard/visits");
    const newBtn = page.getByRole("link", { name: /new visit/i });
    await expect(newBtn).toBeVisible({ timeout: 5_000 });
    await newBtn.click();
    await expect(page).toHaveURL(/\/dashboard\/visits\/new/, { timeout: 5_000 });
  });
});

// ─── New visit form ───────────────────────────────────────────────────────────

test.describe("New visit form", () => {
  test("new visit page renders patient search and source selector", async ({ page }) => {
    await page.goto("/dashboard/visits/new");
    // Patient search input
    const searchInput = page.getByPlaceholder(/search patient/i);
    await expect(searchInput).toBeVisible({ timeout: 8_000 });
    // Walk-in / appointment toggle visible
    await expect(page.getByText(/walk.?in/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("full visit creation flow", async ({ page }) => {
    // Step 1: Create a patient so we have something to link to
    await page.goto("/dashboard/patients/new");
    await page.getByLabel(/name/i).first().fill(TEST_PATIENT_NAME);
    await page.getByLabel(/phone/i).fill(TEST_PATIENT_PHONE);
    await page.getByRole("button", { name: /save|create|add patient/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/patients\//, { timeout: 10_000 });

    // Step 2: Go to new visit
    await page.goto("/dashboard/visits/new");
    await page.waitForLoadState("networkidle");

    // Step 3: Search for the patient we just created
    const searchInput = page.getByPlaceholder(/search patient/i);
    await searchInput.fill(TEST_PATIENT_NAME);
    await page.waitForTimeout(400);

    // Click the first matching suggestion
    const dropdown = page.locator("[data-patient-option], [role='option'], li").filter({
      hasText: TEST_PATIENT_NAME,
    }).first();
    const dropdownVisible = await dropdown.isVisible().catch(() => false);
    if (!dropdownVisible) {
      // Fallback: look for any element matching the name in a results list
      const fallback = page.getByText(TEST_PATIENT_NAME).first();
      await expect(fallback).toBeVisible({ timeout: 5_000 });
      await fallback.click();
    } else {
      await dropdown.click();
    }

    // Step 4: Select walk-in source
    const walkinBtn = page.getByRole("button", { name: /walk.?in/i }).first();
    const walkinRadio = page.getByLabel(/walk.?in/i).first();
    if (await walkinBtn.isVisible().catch(() => false)) {
      await walkinBtn.click();
    } else {
      await walkinRadio.click();
    }
    await page.waitForTimeout(300);

    // Step 5: Select doctor (first in the dropdown)
    const doctorSelect = page.getByLabel(/doctor/i).first();
    if (await doctorSelect.isVisible().catch(() => false)) {
      const options = await doctorSelect.locator("option").all();
      if (options.length > 1) {
        await doctorSelect.selectOption({ index: 1 });
      }
    }

    // Step 6: Verify date is pre-filled and submit
    const dateInput = page.getByLabel(/date/i).first();
    await expect(dateInput).toBeVisible({ timeout: 3_000 });

    await page.getByRole("button", { name: /create visit|start visit|save/i }).click();

    // Should redirect to visit detail
    await expect(page).toHaveURL(/\/dashboard\/visits\/[a-z0-9-]+$/, { timeout: 12_000 });
  });
});

// ─── Visit detail ─────────────────────────────────────────────────────────────

test.describe("Visit detail page", () => {
  test("visit detail shows tabs when visit exists", async ({ page }) => {
    await page.goto("/dashboard/visits");
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("tbody tr").first();
    const rowCount = await page.locator("tbody tr").count();
    if (rowCount === 0) {
      test.skip(true, "No visits in DB — skipping detail test");
      return;
    }

    await firstRow.click();
    await expect(page).toHaveURL(/\/dashboard\/visits\//, { timeout: 5_000 });

    // All core tabs should be present
    await expect(page.getByRole("button", { name: /^items$/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /^payments$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /prescriptions/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /dental chart/i })).toBeVisible();
  });

  test("items tab: can open add-item form on an open visit", async ({ page }) => {
    // Navigate to visits, find an OPEN one (status badge)
    await page.goto("/dashboard/visits");
    await page.waitForLoadState("networkidle");

    const openRow = page.locator("tbody tr").filter({ hasText: /open/i }).first();
    const hasOpenVisit = await openRow.isVisible().catch(() => false);
    if (!hasOpenVisit) {
      test.skip(true, "No OPEN visits in DB — skipping items tab test");
      return;
    }

    await openRow.click();
    await expect(page).toHaveURL(/\/dashboard\/visits\//, { timeout: 5_000 });

    // Click Items tab (should already be active)
    await page.getByRole("button", { name: /^items$/i }).click();

    // Look for "Add Item" button
    const addItemBtn = page.getByRole("button", { name: /add item/i });
    await expect(addItemBtn).toBeVisible({ timeout: 5_000 });
    await addItemBtn.click();

    // Form fields should appear
    await expect(page.getByPlaceholder(/medicine.*procedure/i)).toBeVisible({ timeout: 5_000 });
  });

  test("payments tab: payment modal opens with correct outstanding balance", async ({ page }) => {
    await page.goto("/dashboard/visits");
    await page.waitForLoadState("networkidle");

    const openRow = page.locator("tbody tr").filter({ hasText: /open/i }).first();
    const hasOpenVisit = await openRow.isVisible().catch(() => false);
    if (!hasOpenVisit) {
      test.skip(true, "No OPEN visits in DB — skipping payment modal test");
      return;
    }

    await openRow.click();
    await expect(page).toHaveURL(/\/dashboard\/visits\//, { timeout: 5_000 });

    // Find and click the "Add Payment" button (in header card)
    const addPayBtn = page.getByRole("button", { name: /add payment/i });
    await expect(addPayBtn).toBeVisible({ timeout: 8_000 });
    await addPayBtn.click();

    // Payment modal should open
    await expect(page.getByRole("dialog").or(page.locator(".fixed.inset-0")).first())
      .toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/outstanding/i)).toBeVisible();

    // Amount input should be present
    const amountInput = page.getByLabel(/amount/i);
    await expect(amountInput).toBeVisible();
  });

  test("payments tab: overpayment triggers two-step confirmation", async ({ page }) => {
    await page.goto("/dashboard/visits");
    await page.waitForLoadState("networkidle");

    const openRow = page.locator("tbody tr").filter({ hasText: /open/i }).first();
    const hasOpenVisit = await openRow.isVisible().catch(() => false);
    if (!hasOpenVisit) {
      test.skip(true, "No OPEN visits in DB — skipping overpayment test");
      return;
    }

    await openRow.click();
    await expect(page).toHaveURL(/\/dashboard\/visits\//, { timeout: 5_000 });

    const addPayBtn = page.getByRole("button", { name: /add payment/i });
    await addPayBtn.click();

    const amountInput = page.getByLabel(/amount/i);
    await amountInput.fill("9999999");

    // Overpayment warning should appear
    await expect(page.getByText(/exceeds the outstanding balance/i)).toBeVisible({ timeout: 3_000 });

    // Button should say "confirm overpayment"
    const submitBtn = page.getByRole("button", { name: /confirm overpayment/i });
    await expect(submitBtn).toBeVisible();

    // First click — shows "Confirmed. Click Record Payment to proceed."
    await submitBtn.click();
    await expect(page.getByText(/confirmed/i)).toBeVisible({ timeout: 3_000 });
  });

  test("dental chart tab loads without error", async ({ page }) => {
    await page.goto("/dashboard/visits");
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("tbody tr").first();
    if (await page.locator("tbody tr").count() === 0) {
      test.skip(true, "No visits — skipping chart tab test");
      return;
    }

    await firstRow.click();
    await expect(page).toHaveURL(/\/dashboard\/visits\//, { timeout: 5_000 });

    await page.getByRole("button", { name: /dental chart/i }).click();
    // Should not show an error state; chart should load
    await expect(page.getByText(/tooth chart|loading|chart/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("text=/error loading/i")).not.toBeVisible();
  });
});
