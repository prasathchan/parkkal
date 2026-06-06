/**
 * Tests for lib/billing.ts
 *
 * These test the pure billing calculation functions.
 * No database, no network — just math.
 */
import { describe, it, expect } from "vitest";
import { getBillingStatus, getBalanceDue, getTreatmentOutstanding } from "../billing";

describe("getBillingStatus", () => {
  it("returns PAID when totalAmount is 0 (free visit)", () => {
    expect(getBillingStatus(0, 0)).toBe("PAID");
  });

  it("returns PAID when fully paid", () => {
    expect(getBillingStatus(1000, 1000)).toBe("PAID");
  });

  it("returns PAID even when overpaid", () => {
    expect(getBillingStatus(1000, 1200)).toBe("PAID");
  });

  it("returns PARTIAL when some is paid but not all", () => {
    expect(getBillingStatus(1000, 500)).toBe("PARTIAL");
    expect(getBillingStatus(1000, 1)).toBe("PARTIAL");
    expect(getBillingStatus(1000, 999)).toBe("PARTIAL");
  });

  it("returns PENDING when nothing paid", () => {
    expect(getBillingStatus(1000, 0)).toBe("PENDING");
  });
});

describe("getBalanceDue", () => {
  it("returns the difference", () => {
    expect(getBalanceDue(1000, 600)).toBe(400);
  });

  it("returns 0 when fully paid", () => {
    expect(getBalanceDue(1000, 1000)).toBe(0);
  });

  it("returns 0 when overpaid (never negative)", () => {
    expect(getBalanceDue(1000, 1500)).toBe(0);
  });
});

describe("getTreatmentOutstanding", () => {
  it("returns how much is still to be billed", () => {
    expect(getTreatmentOutstanding(15000, 12000)).toBe(3000);
  });

  it("returns 0 when fully billed", () => {
    expect(getTreatmentOutstanding(15000, 15000)).toBe(0);
  });

  it("returns 0 when overbilled (never negative)", () => {
    expect(getTreatmentOutstanding(15000, 16000)).toBe(0);
  });

  it("returns full cost when nothing billed yet", () => {
    expect(getTreatmentOutstanding(15000, 0)).toBe(15000);
  });
});
