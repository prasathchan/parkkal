/**
 * lib/reminder-scheduler.ts
 *
 * Schedules, reschedules, and cancels appointment reminder rows.
 * Called from the appointments API routes after create/update/cancel.
 *
 * ─── WHEN IS IT CALLED? ──────────────────────────────────────────────────────
 *
 *   POST /api/appointments          → scheduleReminders()  (after insert)
 *   PATCH /api/appointments/[id]    → rescheduleReminders() (date/time changed)
 *                                  → cancelReminders()      (status → CANCELLED)
 *
 * ─── REMINDER SLOTS ──────────────────────────────────────────────────────────
 *
 *   24H — 24 hours before the appointment
 *   2H  — 2 hours before the appointment
 *   1H  — 1 hour before the appointment
 *
 *   Slots in the past are skipped silently (e.g. booking a same-day appointment).
 *
 * ─── CHANNELS (all three sent per slot when contact info is available) ────────
 *
 *   SMS       — sent if patient has a phone number
 *   WHATSAPP  — sent if patient has a phone number (Twilio trial: verified numbers only)
 *   EMAIL     — sent if patient has an email address (via Resend, no paid account needed)
 *
 *   If a patient has both phone and email, they receive all three channels per slot.
 *   If only phone → SMS + WhatsApp. If only email → EMAIL only.
 *   If neither → no reminders scheduled.
 *
 *   Delivery gracefully skips channels whose env vars are missing:
 *     - No TWILIO_*  → SMS/WhatsApp rows inserted but silently skipped at send time
 *     - No RESEND_API_KEY → EMAIL rows inserted but silently skipped at send time
 *
 * ─── DEDUPLICATION ON RESCHEDULE ─────────────────────────────────────────────
 *
 *   On reschedule we:
 *     1. CANCEL all PENDING rows for this appointment
 *     2. Insert new rows for the new date/time
 *   SENT rows are left untouched (immutable audit trail).
 *
 * ─── DATABASE ────────────────────────────────────────────────────────────────
 *
 *   Reads:  patients (name, phone, email), organizations (name), users (name)
 *   Writes: appointment_reminders (insert PENDING, update to CANCELLED)
 */

import { eq, and } from "drizzle-orm";
import { appointmentReminders, patients, organizations, users } from "@/db/schema";
import { buildReminderMessage } from "@/lib/notifications";
import type { NotificationChannel } from "@/lib/notifications";
import { generateId } from "@/lib/utils";
import type { DbInstance } from "@/lib/db";
type DrizzleDB = DbInstance;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppointmentInfo {
  id:              string;
  organizationId:  string;
  patientId:       string;
  doctorId:        string;
  appointmentDate: string;  // "YYYY-MM-DD"
  appointmentTime: string;  // "HH:MM"
}

// ─── Reminder offsets ─────────────────────────────────────────────────────────

const REMINDER_SLOTS = [
  { type: "24H" as const, offsetMs: 24 * 60 * 60 * 1000 },
  { type: "2H"  as const, offsetMs:  2 * 60 * 60 * 1000 },
  { type: "1H"  as const, offsetMs:      60 * 60 * 1000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert "YYYY-MM-DD HH:MM" to Unix ms. */
function toUnixMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

// ─── Core: schedule reminders for one appointment ─────────────────────────────

/**
 * Insert PENDING reminder rows for every slot × channel combination that is
 * still in the future. Safe to call multiple times (e.g. after reschedule).
 *
 * Channels scheduled per patient:
 *   - Has phone  → SMS + WHATSAPP
 *   - Has email  → EMAIL
 */
export async function scheduleReminders(db: DrizzleDB, appt: AppointmentInfo): Promise<void> {
  const apptMs = toUnixMs(appt.appointmentDate, appt.appointmentTime);
  const now    = Date.now();

  // ── Fetch patient contact info ────────────────────────────────────────────
  const [patient] = await db
    .select({ name: patients.name, phone: patients.phone, email: patients.email })
    .from(patients)
    .where(eq(patients.id, appt.patientId));

  // Nothing to send if patient has neither phone nor email
  if (!patient?.phone && !patient?.email) return;

  // ── Fetch clinic name ─────────────────────────────────────────────────────
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, appt.organizationId));

  // ── Fetch doctor name ─────────────────────────────────────────────────────
  const [doctor] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, appt.doctorId));

  const clinicName  = org?.name    ?? "Parkkal Dental";
  const doctorName  = doctor?.name ?? undefined;

  // ── Determine which channels apply for this patient ───────────────────────
  const channels: NotificationChannel[] = [];
  if (patient.phone) {
    channels.push("SMS");
    channels.push("WHATSAPP");
  }
  if (patient.email) {
    channels.push("EMAIL");
  }

  // ── Build reminder rows ───────────────────────────────────────────────────
  const rows = [];

  for (const slot of REMINDER_SLOTS) {
    const scheduledAt = apptMs - slot.offsetMs;
    if (scheduledAt <= now) continue; // slot already in the past — skip

    for (const channel of channels) {
      const message = buildReminderMessage({
        patientName:     patient.name,
        clinicName,
        appointmentDate: appt.appointmentDate,
        appointmentTime: appt.appointmentTime,
        doctorName,
        reminderType:    slot.type,
        channel,
      });

      rows.push({
        id:             generateId(),
        organizationId: appt.organizationId,
        appointmentId:  appt.id,
        patientId:      appt.patientId,
        channel,
        scheduledAt,
        sentAt:         null,
        status:         "PENDING" as const,
        errorMessage:   null,
        message,
        reminderType:   slot.type,
        createdAt:      now,
      });
    }
  }

  if (rows.length === 0) return; // appointment too soon — all slots in the past

  await db.insert(appointmentReminders).values(rows);
}

// ─── Cancel pending reminders ─────────────────────────────────────────────────

/**
 * Mark all PENDING reminders for an appointment as CANCELLED.
 * Call this when an appointment is cancelled or deleted.
 * SENT rows are intentionally left alone (immutable audit trail).
 */
export async function cancelReminders(db: DrizzleDB, appointmentId: string): Promise<void> {
  await db
    .update(appointmentReminders)
    .set({ status: "CANCELLED" })
    .where(
      and(
        eq(appointmentReminders.appointmentId, appointmentId),
        eq(appointmentReminders.status, "PENDING"),
      ),
    );
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

/**
 * Cancel all PENDING reminders for the appointment and schedule new ones.
 * Call this when the appointment date or time changes.
 */
export async function rescheduleReminders(db: DrizzleDB, appt: AppointmentInfo): Promise<void> {
  await cancelReminders(db, appt.id);
  await scheduleReminders(db, appt);
}
