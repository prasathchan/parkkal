import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prescriptions, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const medicineSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  notes: z.string().optional(),
});

const createSchema = z.object({
  medicines: z.array(medicineSchema).min(1),
  instructions: z.string().optional(),
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(eq(visits.id, id));

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.organizationId !== session.orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(prescriptions)
    .where(
      and(
        eq(prescriptions.visitId, id),
        eq(prescriptions.organizationId, session.orgId)
      )
    );

  return NextResponse.json({ prescriptions: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(eq(visits.id, id));

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.organizationId !== session.orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const rxId = `rx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  const [prescription] = await db
    .insert(prescriptions)
    .values({
      id: rxId,
      organizationId: session.orgId,
      visitId: id,
      patientId: data.patientId,
      doctorId: data.doctorId,
      medicines: JSON.stringify(data.medicines),
      instructions: data.instructions ?? null,
      createdAt: now,
    })
    .returning();

  return NextResponse.json({ prescription }, { status: 201 });
}
