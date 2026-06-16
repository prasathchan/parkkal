/**
 * types/appointment.ts
 *
 * TypeScript shapes for appointments.
 */

// ─── Appointment ──────────────────────────────────────────────────────────────

export type AppointmentType   = "CONSULTATION" | "CHECKUP" | "TREATMENT" | "FOLLOWUP";
export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;       // "YYYY-MM-DD"
  appointmentTime?: string | null; // "HH:MM"
  status: AppointmentStatus;
  type: AppointmentType;
  notes?: string | null;
  createdAt: number;
  // Joined fields
  patientName?: string | null;
  patientCode?: string | null;
  doctorName?: string | null;
  /** Set once a visit has been recorded for this appointment */
  visitId?: string | null;
}

// ─── Create payload ───────────────────────────────────────────────────────────

export interface CreateAppointmentPayload {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  appointmentTime?: string;
  type?: AppointmentType;
  notes?: string;
  /** Set when booking from the Recalls page — links appointment back to the recall visit */
  recallVisitId?: string;
}

// ─── Reminder ─────────────────────────────────────────────────────────────────

export type ReminderChannel = "SMS" | "WHATSAPP" | "EMAIL";
export type ReminderType    = "24H" | "2H" | "1H";
export type ReminderStatus  = "PENDING" | "SENT" | "FAILED" | "CANCELLED";

export interface AppointmentReminder {
  id:             string;
  organizationId: string;
  appointmentId:  string;
  patientId:      string;
  channel:        ReminderChannel;
  scheduledAt:    number;   // Unix ms
  sentAt:         number | null;
  status:         ReminderStatus;
  errorMessage:   string | null;
  message:        string;
  reminderType:   ReminderType;
  createdAt:      number;
}

// ─── List response ────────────────────────────────────────────────────────────

export interface AppointmentListResponse {
  appointments: Appointment[];
  total: number;
  hasMore: boolean;
}
