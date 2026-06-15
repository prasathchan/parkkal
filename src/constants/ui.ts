/**
 * constants/ui.ts
 *
 * Tailwind CSS class strings for status badges and colour coding.
 * Centralised here so all pages use the same colours for the same statuses.
 *
 * HOW TO USE:
 *   import { VISIT_STATUS_BADGE } from "@/constants/ui";
 *   <span className={VISIT_STATUS_BADGE[visit.status]}>...</span>
 */

import type { VisitStatus, BillingStatus } from "./visit";
import type { TreatmentStatus } from "./treatment";

/** Badge colours for visit lifecycle status. */
export const VISIT_STATUS_BADGE: Record<VisitStatus, string> = {
  OPEN: "bg-pk-teal-100 text-pk-teal-700",
  COMPLETED: "bg-pk-success-fill text-pk-success-text",
  CANCELLED: "bg-pk-surface-sunken text-pk-text-muted",
};

/** Badge colours for billing status (paid / partial / pending). */
export const BILLING_STATUS_BADGE: Record<BillingStatus, string> = {
  PAID: "bg-pk-success-fill text-pk-success-text",
  PARTIAL: "bg-pk-teal-100 text-pk-teal-700",
  PENDING: "bg-pk-warning-fill text-pk-warning-text",
};

/** Badge colours for treatment plan status. */
export const TREATMENT_STATUS_BADGE: Record<TreatmentStatus, string> = {
  PLANNED: "bg-pk-warning-fill text-pk-warning-text",
  IN_PROGRESS: "bg-pk-teal-100 text-pk-teal-700",
  COMPLETED: "bg-pk-success-fill text-pk-success-text",
};
