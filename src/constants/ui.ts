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
  OPEN: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

/** Badge colours for billing status (paid / partial / pending). */
export const BILLING_STATUS_BADGE: Record<BillingStatus, string> = {
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-blue-100 text-blue-700",
  PENDING: "bg-yellow-100 text-yellow-700",
};

/** Badge colours for treatment plan status. */
export const TREATMENT_STATUS_BADGE: Record<TreatmentStatus, string> = {
  PLANNED: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
};
