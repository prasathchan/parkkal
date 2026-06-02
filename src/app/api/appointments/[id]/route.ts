import { NextRequest, NextResponse } from "next/server";
import { eq, and, notInArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appointments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  type: z.enum(["CONSULTATION", "CHECKUP", "TREATMENT", "FOLLOWUP"]).optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const appt = (await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId))))[0];
  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ appointment: appt });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();

    const appt = (await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId))))[0];
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const data = updateSchema.parse(body);

    // If date or time is being changed, check for doctor conflicts
    const newDate = data.appointmentDate ?? appt.appointmentDate;
    const newTime = data.appointmentTime ?? appt.appointmentTime;
    const dateOrTimeChanged = data.appointmentDate !== undefined || data.appointmentTime !== undefined;

    if (dateOrTimeChanged) {
      const [conflict] = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.organizationId, session.orgId),
            eq(appointments.doctorId, appt.doctorId),
            eq(appointments.appointmentDate, newDate),
            eq(appointments.appointmentTime, newTime),
            notInArray(appointments.status, ["CANCELLED", "NO_SHOW"])
          )
        );
      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { error: "This doctor already has an appointment at that date and time" },
          { status: 409 }
        );
      }
    }

    await db.update(appointments).set(data).where(eq(appointments.id, id));
    const updated = (await db.select().from(appointments).where(eq(appointments.id, id)))[0];
    return NextResponse.json({ appointment: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [appt] = await db
    .select({ id: appointments.id, organizationId: appointments.organizationId })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.organizationId, session.orgId)));

  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent deleting if a visit already exists for this appointment
  const [linked] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.appointmentId, id), eq(visits.organizationId, session.orgId)));

  if (linked) {
    return NextResponse.json({ error: "Cannot delete appointment: a visit is linked to it" }, { status: 409 });
  }

  await db.delete(appointments).where(eq(appointments.id, id));
  return NextResponse.json({ success: true });
}
