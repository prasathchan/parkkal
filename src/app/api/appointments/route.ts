import { eq, asc, and, count } from "drizzle-orm";
import { appointments, patients, users, organizationPatients } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { generateId } from "@/lib/utils";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

// Detect the sentinel error raised by BEFORE INSERT / BEFORE UPDATE triggers
// in migration 0021 — trigger fires RAISE(ABORT, 'SLOT_TAKEN').
function isSlotTaken(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("SLOT_TAKEN");
}

const createSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "appointmentDate must be YYYY-MM-DD"),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/, "appointmentTime must be HH:MM"),
  type: z.enum(["CONSULTATION", "CHECKUP", "TREATMENT", "FOLLOWUP"]).default("CONSULTATION"),
  notes: z.string().optional(),
});

/** GET /api/appointments — list appointments for the org (doctors see only their own) */
export const GET = withRoute(
  { route: "GET /api/appointments", permission: PERMISSIONS.APPOINTMENTS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const dateFilter = searchParams.get("date");
    const statusFilter = searchParams.get("status");
    const patientIdFilter = searchParams.get("patientId");

    // RBAC: DOCTOR role may only see their own appointments
    const doctorIdFilter = session.role === "DOCTOR" ? session.userId : searchParams.get("doctorId");

    const conditions = [eq(appointments.organizationId, session.orgId)];
    if (dateFilter) conditions.push(eq(appointments.appointmentDate, dateFilter));
    if (statusFilter)
      conditions.push(eq(appointments.status, statusFilter as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW"));
    if (patientIdFilter) conditions.push(eq(appointments.patientId, patientIdFilter));
    if (doctorIdFilter) conditions.push(eq(appointments.doctorId, doctorIdFilter));

    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const offset = Number(searchParams.get("offset") ?? 0);

    const [{ total }] = await db.select({ total: count() }).from(appointments).where(and(...conditions));

    const rows = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        appointmentDate: appointments.appointmentDate,
        appointmentTime: appointments.appointmentTime,
        status: appointments.status,
        type: appointments.type,
        notes: appointments.notes,
        createdAt: appointments.createdAt,
        patientName: patients.name,
        doctorName: users.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .where(and(...conditions))
      // Clinic staff need chronological schedule view
      .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
      .limit(limit)
      .offset(offset);

    return apiOk({ appointments: rows, total, hasMore: offset + rows.length < total });
  }
);

/** POST /api/appointments — create a new appointment */
export const POST = withRoute(
  { route: "POST /api/appointments", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.APPOINTMENTS_CREATE },
  async (req, { session, db, log }) => {
    const body = await req.json();
    const data = createSchema.parse(body);
    // RBAC: DOCTOR role can only create appointments for themselves
    if (session.role === "DOCTOR") data.doctorId = session.userId;

    // Verify patient belongs to this org
    const [patientLink] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, data.patientId)));
    if (!patientLink) return apiError("Patient does not belong to this organization", 400);

    const newAppt = {
      id: generateId(),
      organizationId: session.orgId,
      patientId: data.patientId,
      doctorId: data.doctorId,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      status: "SCHEDULED" as const,
      type: data.type,
      notes: data.notes || null,
      createdAt: Date.now(),
    };

    try {
      await db.insert(appointments).values(newAppt);
    } catch (err) {
      if (isSlotTaken(err)) return apiError("This doctor already has an appointment at that date and time", 409);
      throw err; // re-throw for withRoute's generic 500 handler
    }

    log.info("Appointment created", { appointmentId: newAppt.id, patientId: newAppt.patientId });
    return apiOk({ appointment: newAppt }, 201);
  }
);
