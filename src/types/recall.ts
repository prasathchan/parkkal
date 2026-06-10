/**
 * types/recall.ts
 *
 * TypeScript shapes for the recalls dashboard.
 * A "recall" is a visit that has a future recall date set,
 * prompting the clinic to follow up with the patient.
 *
 * ─── RECALL STATUS ────────────────────────────────────────────────────────────
 *
 *   UNSCHEDULED  — recall date is set but no appointment booked yet
 *   SCHEDULED    — appointment booked (recallAppointmentId set, not yet attended)
 *   FULFILLED    — patient attended the recall appointment
 *   LAPSED       — recall date passed with no booking, OR booking was cancelled
 */

export type RecallStatus = "UNSCHEDULED" | "SCHEDULED" | "FULFILLED" | "LAPSED";

export interface RecallVisit {
  id: string;
  visitCode: string;
  visitDate: string;            // "YYYY-MM-DD"
  recallDate: string;           // "YYYY-MM-DD"
  recallNotes?: string | null;
  status: string;               // visit status (OPEN / COMPLETED)
  recallStatus: RecallStatus;   // computed — see type above
  patientId: string;
  patientName: string | null;
  patientCode: string | null;
  patientPhone: string | null;
  doctorName: string | null;
  isOverdue: boolean;
  daysUntilRecall: number | null;  // negative = overdue
  // Set when recall has been booked
  recallAppointmentId?: string | null;
  recallAppointmentDate?: string | null;
  recallAppointmentTime?: string | null;
  recallAppointmentStatus?: string | null;
}

export interface RecallListResponse {
  recalls: RecallVisit[];
  total: number;
  hasMore: boolean;
}
