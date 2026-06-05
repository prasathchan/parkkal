import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments, patients, users, organizationPatients, organizationMembers, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
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
  visitId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.TREATMENTS_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const patientIdFilter = searchParams.get("patientId");
  const dateFilter = searchParams.get("date");
  const visitIdFilter = searchParams.get("visitId");
  const doctorIdFilter =
    session.role === "DOCTOR" ? session.userId : searchParams.get("doctorId");

  const db = getDb();

  const conditions = [eq(treatments.organizationId, session.orgId)];
  if (patientIdFilter) conditions.push(eq(treatments.patientId, patientIdFilter));
  if (visitIdFilter) conditions.push(eq(treatments.visitId, visitIdFilter));
  if (doctorIdFilter) conditions.push(eq(treatments.doctorId, doctorIdFilter));
  if (dateFilter) {
    const dayStart = new Date(dateFilter + "T00:00:00").getTime();
    const dayEnd = new Date(dateFilter + "T23:59:59.999").getTime();
    conditions.push(gte(treatments.createdAt, dayStart));
    conditions.push(lte(treatments.createdAt, dayEnd));
  }

  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  const [{ total }] = await db
    .select({ total: count() })
    .from(treatments)
    .where(and(...conditions));

  const rows = await db
    .select({
      id: treatments.id,
      patientId: treatments.patientId,
      doctorId: treatments.doctorId,
      visitId: treatments.visitId,
      appointmentId: treatments.appointmentId,
      description: treatments.description,
      toothNumbers: treatments.toothNumbers,
      procedure: treatments.procedure,
      cost: treatments.cost,
      status: treatments.status,
      createdAt: treatments.createdAt,
      consentStatus: treatments.consentStatus,
      consentDocumentUrl: treatments.consentDocumentUrl,
      consentDocumentName: treatments.consentDocumentName,
      consentUploadedAt: treatments.consentUploadedAt,
      consentNotes: treatments.consentNotes,
      patientName: patients.name,
      patientCode: patients.patientCode,
      doctorName: users.name,
    })
    .from(treatments)
    .leftJoin(patients, eq(treatments.patientId, patients.id))
    .leftJoin(users, eq(treatments.doctorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(treatments.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ treatments: rows, total, hasMore: offset + rows.length < total });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.TREATMENTS_CREATE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createTreatmentSchema.parse(body);

    // DOCTOR role can only create treatments assigned to themselves
    if (session.role === "DOCTOR") {
      data.doctorId = session.userId;
    }

    const db = getDb();

    const [patientOrgLink] = await db.select().from(organizationPatients)
      .where(and(
        eq(organizationPatients.organizationId, session.orgId),
        eq(organizationPatients.patientId, data.patientId),
        eq(organizationPatients.isActive, 1),
      ));
    if (!patientOrgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Verify doctor belongs to this org and is active
    const [doctorMembership] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, session.orgId),
        eq(organizationMembers.userId, data.doctorId),
        eq(organizationMembers.isActive, 1),
      ));
    if (!doctorMembership) return NextResponse.json({ error: "Doctor does not belong to this organization" }, { status: 400 });

    if (data.visitId) {
      const [visit] = await db.select({ id: visits.id }).from(visits)
        .where(and(eq(visits.id, data.visitId), eq(visits.organizationId, session.orgId)));
      if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

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
      visitId: data.visitId ?? null,
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
