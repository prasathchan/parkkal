/**
 * constants/visit.ts
 *
 * Every magic string related to visits lives here.
 * If you need to add a new visit status or a new bill item category,
 * this is the ONE file you change — everything else reads from here.
 *
 * HOW TO USE:
 *   import { VISIT_STATUS, ITEM_CATEGORIES } from "@/constants/visit";
 *   if (visit.status === VISIT_STATUS.OPEN) { ... }
 */

// ─── Visit lifecycle ─────────────────────────────────────────────────────────

/** The three states a visit can be in. */
export const VISIT_STATUS = {
  /** Doctor is still seeing the patient — visit is in progress. */
  OPEN: "OPEN",
  /** Visit is done. Clinical notes and billing are finalised. */
  COMPLETED: "COMPLETED",
  /** Visit was cancelled before it happened. */
  CANCELLED: "CANCELLED",
} as const;

export type VisitStatus = (typeof VISIT_STATUS)[keyof typeof VISIT_STATUS];

// ─── Bill item categories ─────────────────────────────────────────────────────

/**
 * Categories used when adding a line item to a visit bill.
 * Each category maps to a meaningful group on the invoice.
 */
export const ITEM_CATEGORY = {
  MEDICINE: "MEDICINE",
  PROCEDURE: "PROCEDURE",
  XRAY: "XRAY",
  CONSULTATION: "CONSULTATION",
  /** Links to a treatment plan — e.g. partial payment for root canal */
  TREATMENT: "TREATMENT",
  OTHER: "OTHER",
} as const;

export type ItemCategory = (typeof ITEM_CATEGORY)[keyof typeof ITEM_CATEGORY];

/** Human-readable labels for each category, shown in dropdowns. */
export const ITEM_CATEGORY_LABEL: Record<ItemCategory, string> = {
  MEDICINE: "Medicine",
  PROCEDURE: "Procedure",
  XRAY: "X-Ray",
  CONSULTATION: "Consultation",
  TREATMENT: "Treatment Plan",
  OTHER: "Other",
};

// ─── Payment methods ──────────────────────────────────────────────────────────

export const PAYMENT_METHOD = {
  CASH: "CASH",
  CARD: "CARD",
  UPI: "UPI",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

/** Human-readable labels shown in the payment method dropdown. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
};

// ─── Billing status (computed, not stored) ────────────────────────────────────

/**
 * Billing status is NOT stored in the database — it is computed from
 * totalAmount vs paidAmount every time it is needed.
 * See: getBillingStatus() in @/lib/billing.ts
 */
export const BILLING_STATUS = {
  /** All money collected (or visit had ₹0 total). */
  PAID: "PAID",
  /** Some money collected but not all. */
  PARTIAL: "PARTIAL",
  /** No money collected yet. */
  PENDING: "PENDING",
} as const;

export type BillingStatus = (typeof BILLING_STATUS)[keyof typeof BILLING_STATUS];

// ─── Treatment → tooth condition inference map ────────────────────────────────

/**
 * Maps lowercase keyword patterns to tooth chart condition codes.
 * Used when linking a treatment plan to a visit to auto-mark the tooth chart.
 * Admins can extend this via org settings (stored in organizations.treatmentConditionMap).
 * The first matching entry wins, so order matters — more specific patterns first.
 */
export const TREATMENT_CONDITION_MAP: Array<{ pattern: RegExp; condition: string }> = [
  { pattern: /root.?canal|rct|endodont/i,              condition: "ROOT_CANAL"  },
  { pattern: /crown|ceramic|porcelain|zirconia|pfm/i,  condition: "CROWN"       },
  { pattern: /implant/i,                               condition: "IMPLANT"     },
  { pattern: /bridge/i,                                condition: "BRIDGE"      },
  { pattern: /extract|remov|pull|avuls/i,              condition: "MISSING"     },
  { pattern: /fractur|crack|chip/i,                    condition: "FRACTURED"   },
  { pattern: /filling|composite|amalgam|restoration/i, condition: "FILLING"     },
];

/** Returns the tooth chart condition for a treatment description, or "WATCH" if no match. */
export function inferToothCondition(description: string, procedure?: string | null): string {
  const text = `${description} ${procedure ?? ""}`;
  for (const { pattern, condition } of TREATMENT_CONDITION_MAP) {
    if (pattern.test(text)) return condition;
  }
  return "WATCH";
}
