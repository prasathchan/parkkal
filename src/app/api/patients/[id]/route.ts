import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { patients, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updatePatientSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const patient = (await db.select().from(patients).where(eq(patients.id, id)))[0];

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const orgLink = (await db
    .select()
    .from(organizationPatients)
    .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patient.id)))
  )[0];

  if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ patient });
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

    const orgLink = (await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id))))[0];
    if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const data = updatePatientSchema.parse(body);

    await db.update(patients).set({ ...data, updatedAt: Date.now() }).where(eq(patients.id, id));
    const updated = (await db.select().from(patients).where(eq(patients.id, id)))[0];
    return NextResponse.json({ patient: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    console.error("Update patient error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = getDb();

  const orgLink = (await db.select().from(organizationPatients)
    .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id))))[0];
  if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(patients).where(eq(patients.id, id));
  return NextResponse.json({ success: true });
}
