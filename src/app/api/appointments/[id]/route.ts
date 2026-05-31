import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appointments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
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
  const appt = (await db.select().from(appointments).where(eq(appointments.id, id)))[0];
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
    const body = await request.json();
    const data = updateSchema.parse(body);

    const db = getDb();
    await db.update(appointments).set(data).where(eq(appointments.id, id));
    const updated = (await db.select().from(appointments).where(eq(appointments.id, id)))[0];
    return NextResponse.json({ appointment: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
