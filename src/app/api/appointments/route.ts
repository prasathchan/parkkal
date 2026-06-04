import { NextRequest, NextResponse } from "next/server";
import { eq, desc, asc, and, notInArray, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appointments, patients, users, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { z } from "zod";

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

    // Check for doctor time conflict
    const [conflict] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, session.orgId),
          eq(appointments.doctorId, data.doctorId),
          eq(appointments.appointmentDate, data.appointmentDate),
          eq(appointments.appointmentTime, data.appointmentTime),
          notInArray(appointments.status, ["CANCELLED", "NO_SHOW"])
        )
      );

    if (conflict) {
      return NextResponse.json(
        { error: "This doctor already has an appointment at that date and time" },
        { status: 409 }
      );
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
    return NextResponse.json({ appointment: newAppt }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Create appointment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
