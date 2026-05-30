import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments, patients, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  doctorId: z.string().min(1),
  description: z.string().min(1),
  toothNumbers: z.string().optional(),
  procedure: z.string().optional(),
  cost: z.number().default(0),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const patientIdFilter = searchParams.get("patientId");

  const db = getDb();

  const conditions = [eq(treatments.organizationId, session.orgId)];
  if (patientIdFilter) conditions.push(eq(treatments.patientId, patientIdFilter));

  const rows = await db
    .select({
      id: treatments.id,
      patientId: treatments.patientId,
      appointmentId: treatments.appointmentId,
      doctorId: treatments.doctorId,
      description: treatments.description,
      toothNumbers: treatments.toothNumbers,
      procedure: treatments.procedure,
      cost: treatments.cost,
      createdAt: treatments.createdAt,
      patientName: patients.name,
      doctorName: users.name,
    })
    .from(treatments)
    .leftJoin(patients, eq(treatments.patientId, patients.id))
    .leftJoin(users, eq(treatments.doctorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(treatments.createdAt))
    .all();

  return NextResponse.json({ treatments: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const db = getDb();
    const newTreatment = {
      id: generateId(),
      organizationId: session.orgId,
      patientId: data.patientId,
      appointmentId: data.appointmentId || null,
      doctorId: data.doctorId,
      description: data.description,
      toothNumbers: data.toothNumbers || null,
      procedure: data.procedure || null,
      cost: data.cost,
      createdAt: Date.now(),
    };

    await db.insert(treatments).values(newTreatment);
    return NextResponse.json({ treatment: newTreatment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
