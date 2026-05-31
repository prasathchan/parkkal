import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments, patients, users, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const createTreatmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  description: z.string().min(1),
  toothNumbers: z.string().optional(),
  procedure: z.string().optional(),
  cost: z.number().default(0),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]).default("PLANNED"),
  appointmentId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const patientIdFilter = searchParams.get("patientId");
  const dateFilter = searchParams.get("date");

  const db = getDb();

  const conditions = [eq(treatments.organizationId, session.orgId)];
  if (patientIdFilter) conditions.push(eq(treatments.patientId, patientIdFilter));
  if (dateFilter) {
    const dayStart = new Date(dateFilter + "T00:00:00").getTime();
    const dayEnd = new Date(dateFilter + "T23:59:59.999").getTime();
    conditions.push(gte(treatments.createdAt, dayStart));
    conditions.push(lte(treatments.createdAt, dayEnd));
  }

  const rows = await db
    .select({
      id: treatments.id,
      patientId: treatments.patientId,
      doctorId: treatments.doctorId,
      description: treatments.description,
      toothNumbers: treatments.toothNumbers,
      procedure: treatments.procedure,
      cost: treatments.cost,
      status: treatments.status,
      createdAt: treatments.createdAt,
      patientName: patients.name,
      patientCode: patients.patientCode,
      doctorName: users.name,
    })
    .from(treatments)
    .leftJoin(patients, eq(treatments.patientId, patients.id))
    .leftJoin(users, eq(treatments.doctorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(treatments.createdAt));

  return NextResponse.json({ treatments: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createTreatmentSchema.parse(body);
    const db = getDb();

    const [patientOrgLink] = await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, data.patientId)));
    if (!patientOrgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const treatment = {
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      patientId: data.patientId,
      doctorId: data.doctorId,
      description: data.description,
      toothNumbers: data.toothNumbers ?? null,
      procedure: data.procedure ?? null,
      cost: data.cost,
      status: data.status,
      appointmentId: data.appointmentId ?? null,
      createdAt: Date.now(),
    };

    await db.insert(treatments).values(treatment);

    return NextResponse.json({ treatment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Create treatment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
