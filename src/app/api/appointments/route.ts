import { NextRequest, NextResponse } from "next/server";
import { eq, asc, and, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appointments, patients, users, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Detect the sentinel error raised by the BEFORE INSERT / BEFORE UPDATE triggers
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

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/appointments", session);
  if (!await hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW)) {
    log.security("Permission denied: appointments.view", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateFilter = searchParams.get("date");
  const statusFilter = searchParams.get("status");
  const patientIdFilter = searchParams.get("patientId");

  // RBAC: DOCTOR role may only see their own appointments.
  // Ignore any doctorId passed by the client — derive it server-side.
  const doctorIdFilter =
    session.role === "DOCTOR"
      ? session.userId
      : searchParams.get("doctorId");

  const db = getDb();

  const conditions = [eq(appointments.organizationId, session.orgId)];
  if (dateFilter) conditions.push(eq(appointments.appointmentDate, dateFilter));
  if (statusFilter)
    conditions.push(
      eq(
        appointments.status,
        statusFilter as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
      )
    );
  if (patientIdFilter) conditions.push(eq(appointments.patientId, patientIdFilter));
  if (doctorIdFilter) conditions.push(eq(appointments.doctorId, doctorIdFilter));

  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  const [{ total }] = await db
    .select({ total: count() })
    .from(appointments)
    .where(and(...conditions));

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
    // Clinic staff need chronological schedule, not creation-order.
    .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ appointments: rows, total, hasMore: offset + rows.length < total });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/appointments", session);
  if (!await hasPermission(session, PERMISSIONS.APPOINTMENTS_CREATE)) {
    log.security("Permission denied: appointments.create", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    // RBAC: DOCTOR role can only create appointments for themselves
    if (session.role === "DOCTOR") data.doctorId = session.userId;

    const db = getDb();

    // Verify patient belongs to this org
    const [patientLink] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, data.patientId)));
    if (!patientLink) {
      return NextResponse.json({ error: "Patient does not belong to this organization" }, { status: 400 });
    }

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

    await db.insert(appointments).values(newAppt);
    log.info("Appointment created", { appointmentId: newAppt.id, patientId: newAppt.patientId, doctorId: newAppt.doctorId });
    return NextResponse.json({ appointment: newAppt }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    if (isSlotTaken(error)) {
      return NextResponse.json(
        { error: "This doctor already has an appointment at that date and time" },
        { status: 409 }
      );
    }
    log.error("Failed to create appointment", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
