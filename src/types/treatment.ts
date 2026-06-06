/**
 * types/treatment.ts
 *
 * TypeScript shapes for treatment plans and consent records.
 *
 * A "treatment plan" is a multi-session procedure (e.g. root canal, braces).
 * It belongs to a patient and can span many visits. Each payment towards
 * it is a TREATMENT-category bill item with linkedTreatmentId set.
 */

import type { TreatmentStatus, ConsentStatus } from "@/constants/treatment";

// ─── Treatment plan ───────────────────────────────────────────────────────────

export interface Treatment {
  id: string;
  organizationId: string;
  patientId: string;
  doctorId: string;
  description: string;          // e.g. "Root Canal Treatment - UL6"
  procedure?: string | null;    // Short clinical code, e.g. "RCT"
  toothNumbers?: string | null; // Comma-separated, e.g. "26,27"
  cost: number;                 // Total planned cost of the treatment
  status: TreatmentStatus;
  appointmentId?: string | null;
  consentStatus: ConsentStatus;
  consentDocumentUrl?: string | null;
  consentDocumentName?: string | null;
  consentUploadedAt?: number | null;
  consentNotes?: string | null;
  emergencyOverride: 0 | 1;
  createdAt: number;
  // Joined fields
  patientName?: string | null;
  doctorName?: string | null;
  /**
   * How much has already been billed across ALL visits for this treatment.
   * Computed as SUM(visit_items.amount WHERE linked_treatment_id = this.id).
   * Outstanding = cost - billedAmount.
   */
  billedAmount?: number;
  /** Notes added when linking this treatment to a specific visit. */
  linkNotes?: string | null;
}
