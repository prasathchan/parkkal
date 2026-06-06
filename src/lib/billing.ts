/**
 * lib/billing.ts
 *
 * Pure utility functions for billing calculations.
 * "Pure" means: no database calls, no API calls, just math on numbers.
 *
 * WHY A SEPARATE FILE:
 *   Billing status is computed from two numbers (totalAmount, paidAmount).
 *   Without a shared function, every page that shows billing status
 *   copies the same if/else logic. This file is the ONE source of truth.
 */

import { BILLING_STATUS, type BillingStatus } from "@/constants/visit";

/**
 * Compute the billing status from totalAmount and paidAmount.
 *
 * Rules:
 * - A visit with ₹0 total is PAID (nothing to collect — e.g. free consult).
 * - If paid >= total, it's PAID.
 * - If paid > 0 but less than total, it's PARTIAL.
 * - If paid = 0, it's PENDING.
 *
 * @example
 *   getBillingStatus(1000, 1000) // → "PAID"
 *   getBillingStatus(1000, 500)  // → "PARTIAL"
 *   getBillingStatus(1000, 0)    // → "PENDING"
 *   getBillingStatus(0, 0)       // → "PAID"  (free visit)
 */
export function getBillingStatus(
  totalAmount: number,
  paidAmount: number,
): BillingStatus {
  if (totalAmount === 0) return BILLING_STATUS.PAID;
  if (paidAmount >= totalAmount) return BILLING_STATUS.PAID;
  if (paidAmount > 0) return BILLING_STATUS.PARTIAL;
  return BILLING_STATUS.PENDING;
}

/**
 * How much money is still owed on a visit.
 * Always returns 0 or a positive number — never negative.
 *
 * @example
 *   getBalanceDue(1000, 600) // → 400
 *   getBalanceDue(1000, 1200) // → 0  (overpaid, but never negative)
 */
export function getBalanceDue(totalAmount: number, paidAmount: number): number {
  return Math.max(0, totalAmount - paidAmount);
}

/**
 * How much of a treatment plan has NOT yet been billed.
 *
 * @param treatmentCost   Total cost of the treatment plan (e.g. ₹15,000)
 * @param billedAmount    Amount already billed in visit items (e.g. ₹12,000)
 * @returns               Outstanding amount (e.g. ₹3,000), never negative
 */
export function getTreatmentOutstanding(
  treatmentCost: number,
  billedAmount: number,
): number {
  return Math.max(0, treatmentCost - billedAmount);
}
