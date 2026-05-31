import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appointments, patients, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  appointmentDate: z.string().min(1),
  appointmentTime: z.string().min(1),
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

  const db = getDb();

  const conditions = [eq(appointments.organizationId, session.orgId)];
  if (dateFilter) conditions.push(eq(appointments.appointmentDate, dateFilter));
  if (statusFilter) conditions.push(eq(appointments.status, statusFilter as "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"));
  if (patientIdFilter) conditions.push(eq(appointments.patientId, patientIdFilter));

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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(appointments.createdAt))
    ;

  return NextResponse.json({ appointments: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const db = getDb();
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
