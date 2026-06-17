/**
 * constants/treatment.ts
 *
 * Magic strings for treatment plans and consent.
 */

export const TREATMENT_STATUS = {
  /** Plan created, work not started yet. */
  PLANNED: "PLANNED",
  /** Work has started (e.g. first session done). */
  IN_PROGRESS: "IN_PROGRESS",
  /** All sessions complete. */
  COMPLETED: "COMPLETED",
} as const;

export type TreatmentStatus =
  (typeof TREATMENT_STATUS)[keyof typeof TREATMENT_STATUS];

export const TREATMENT_STATUS_LABEL: Record<TreatmentStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

// ─── Consent ──────────────────────────────────────────────────────────────────

export const CONSENT_STATUS = {
  /** Patient has not yet provided consent. */
  PENDING: "PENDING",
  /** Document uploaded — awaiting staff verification. */
  UPLOADED: "UPLOADED",
  /** AI or staff has verified the document is legible and signed. */
  VERIFIED: "VERIFIED",
  /** Document was rejected (illegible or missing signature). */
  REJECTED: "REJECTED",
  /** Emergency override used — doctor proceeded without consent. */
  EMERGENCY_OVERRIDE: "EMERGENCY_OVERRIDE",
} as const;

export type ConsentStatus =
  (typeof CONSENT_STATUS)[keyof typeof CONSENT_STATUS];
