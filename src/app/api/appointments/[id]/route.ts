import { eq, and, notInArray } from "drizzle-orm";
import { appointments, patients, users, visits } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { rescheduleReminders, cancelReminders } from "@/lib/reminder-scheduler";
import { syncAppointmentToCalendar, removeAppointmentFromCalendar } from "@/lib/calendar-sync";
import { z } from "zod";

// Detect the sentinel error raised by migration 0021 triggers.
function isSlotTaken(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("SLOT_TAKEN");
}

const updateSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  type: z.enum(["CONSULTATION", "CHECKUP", "TREATMENT", "FOLLOWUP"]).optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  notes: z.string().optional(),
});

/** GET /api/appointments/[id] — fetch a single appointment */
export const GET = withRoute<{ id: string }>(
  { route: "GET /api/appointments/[id]" },
  async (_req, { session, db }, { id }) => {
    const [appt] = await db
      .select({
        id:              appointments.id,
        patientId:       appointments.patientId,
        doctorId:        appointments.doctorId,
        appointmentDate: appointments.appointmentDate,
        appointmentTime: appointments.appointmentTime,
        status:          appointments.status,
        type:            appointments.type,
        notes:           appointments.notes,
        createdAt:       appointments.createdAt,
        patientName:     patients.name,
        doctorName:      users.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId)));
    if (!appt) return apiError("Not found", 404);
    return apiOk({ appointment: appt });
  }
);

/** PATCH /api/appointments/[id] — update status, type, notes, or reschedule */
export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/appointments/[id]", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }, { id }) => {
    const [appt] = await db.select().from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId)));
    if (!appt) return apiError("Not found", 404);

    const data = updateSchema.parse(await req.json());

    const RESCHEDULE_ROLES = ["ADMIN", "RECEPTIONIST", "DOCTOR"];
    const dateOrTimeChanged  = data.appointmentDate !== undefined || data.appointmentTime !== undefined;
    const isCancelling       = data.status === "CANCELLED" || data.status === "NO_SHOW";

    if (dateOrTimeChanged && !RESCHEDULE_ROLES.includes(session.role)) {
      return apiError("Forbidden", 403);
    }

    if (dateOrTimeChanged) {
      const newDate = data.appointmentDate ?? appt.appointmentDate;
      const newTime = data.appointmentTime ?? appt.appointmentTime;
      const [conflict] = await db.select({ id: appointments.id }).from(appointments)
        .where(and(
          eq(appointments.organizationId, session.orgId),
          eq(appointments.doctorId, appt.doctorId),
          eq(appointments.appointmentDate, newDate),
          eq(appointments.appointmentTime, newTime),
          notInArray(appointments.status, ["CANCELLED", "NO_SHOW"])
        ));
      if (conflict && conflict.id !== id) {
        return apiError("This doctor already has an appointment at that date and time", 409);
      }
    }

    try {
      await db.update(appointments).set(data).where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId)));
    } catch (err) {
      if (isSlotTaken(err)) return apiError("This doctor already has an appointment at that date and time", 409);
      throw err;
    }

    const [updated] = await db
      .select({
        id:              appointments.id,
        patientId:       appointments.patientId,
        doctorId:        appointments.doctorId,
        appointmentDate: appointments.appointmentDate,
        appointmentTime: appointments.appointmentTime,
        status:          appointments.status,
        type:            appointments.type,
        notes:           appointments.notes,
        createdAt:       appointments.createdAt,
        patientName:     patients.name,
        doctorName:      users.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId)));
    log.info("Appointment updated", { appointmentId: id });

    // Reminder side-effects (fire-and-forget — never block the response)
    if (isCancelling) {
      cancelReminders(db, id).catch((err: unknown) => {
        log.error("Failed to cancel reminders", {
          appointmentId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } else if (dateOrTimeChanged && updated?.appointmentTime) {
      rescheduleReminders(db, {
        id,
        organizationId:  session.orgId,
        patientId:       updated.patientId,
        doctorId:        updated.doctorId,
        appointmentDate: updated.appointmentDate,
        appointmentTime: updated.appointmentTime,
      }).catch((err: unknown) => {
        log.error("Failed to reschedule reminders", {
          appointmentId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // Calendar sync side-effects (fire-and-forget)
    if (isCancelling) {
      removeAppointmentFromCalendar(db, appt.doctorId, session.orgId, id).catch(() => {});
    } else if (updated) {
      syncAppointmentToCalendar(db, updated.doctorId, session.orgId, {
        appointmentId: id,
        title: "Dental Appointment",
        date:  updated.appointmentDate,
        time:  updated.appointmentTime,
        durationMins: 30,
        notes: updated.notes ?? undefined,
      }).catch(() => {});
    }

    return apiOk({ appointment: updated });
  }
);

/** DELETE /api/appointments/[id] — hard-delete (ADMIN or RECEPTIONIST only) */
export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/appointments/[id]", rateLimit: RATE_LIMITS.DESTRUCTIVE },
  async (_req, { session, db, log }, { id }) => {
    if (!["ADMIN", "RECEPTIONIST"].includes(session.role)) {
      log.security("Permission denied: insufficient role to delete appointment", { role: session.role });
      return apiError("Forbidden", 403);
    }

    const [appt] = await db.select({ id: appointments.id, doctorId: appointments.doctorId }).from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId)));
    if (!appt) return apiError("Not found", 404);

    // Block delete if a visit is already linked to this appointment
    const [linked] = await db.select({ id: visits.id }).from(visits)
      .where(and(eq(visits.appointmentId, id), eq(visits.organizationId, session.orgId)));
    if (linked) return apiError("Cannot delete appointment: a visit is linked to it", 409);

    await db.delete(appointments).where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId)));
    // Cancel any pending reminders so the cron job doesn't attempt delivery
    await cancelReminders(db, id);
    // Remove from doctor's personal calendar (fire-and-forget)
    removeAppointmentFromCalendar(db, appt.doctorId, session.orgId, id).catch(() => {});
    log.info("Appointment deleted", { appointmentId: id });
    return apiOk({ success: true });
  }
);
