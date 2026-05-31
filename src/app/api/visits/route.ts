import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits, patients, users, organizations, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";

function generateVisitCode(date: string, seq: number): string {
  const d = date.replace(/-/g, "");
  return `VIS-${d}-${String(seq).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const doctorId = searchParams.get("doctorId");
  const status = searchParams.get("status");
  const date = searchParams.get("date");

  const db = getDb();

  const conditions = [eq(visits.organizationId, session.orgId)];
  if (patientId) conditions.push(eq(visits.patientId, patientId));
  if (doctorId) conditions.push(eq(visits.doctorId, doctorId));
  if (status) conditions.push(eq(visits.status, status as "OPEN" | "COMPLETED" | "CANCELLED"));
  if (date) conditions.push(eq(visits.visitDate, date));

  const rows = await db
    .select({
      id: visits.id,
      visitCode: visits.visitCode,
      patientId: visits.patientId,
      doctorId: visits.doctorId,
      visitDate: visits.visitDate,
      status: visits.status,
      totalAmount: visits.totalAmount,
      paidAmount: visits.paidAmount,
      createdAt: visits.createdAt,
      updatedAt: visits.updatedAt,
      patientName: patients.name,
      patientCode: patients.patientCode,
      doctorName: users.name,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(users, eq(visits.doctorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(visits.createdAt))
    ;

  return NextResponse.json({ visits: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { patientId, doctorId, visitDate, chiefComplaint, doctorNotes, appointmentId, visitType } = body;

    if (!patientId || !doctorId || !visitDate) {
      return NextResponse.json({ error: "patientId, doctorId, visitDate are required" }, { status: 400 });
    }

    const db = getDb();

    // Debug: verify FK references exist
    const [orgExists] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, session.orgId));
    const [patientExists] = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId));
    const [doctorExists] = await db.select({ id: users.id }).from(users).where(eq(users.id, doctorId));
    if (!orgExists) return NextResponse.json({ error: `Organization not found: ${session.orgId}` }, { status: 400 });
    if (!patientExists) return NextResponse.json({ error: `Patient not found: ${patientId}` }, { status: 400 });
    if (!doctorExists) return NextResponse.json({ error: `Doctor not found: ${doctorId}` }, { status: 400 });

    const [patientOrgLink] = await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patientId)));
    if (!patientOrgLink) return NextResponse.json({ error: "Patient does not belong to this organization" }, { status: 400 });

    // Count today's visits for sequence
    const [{ todayCount }] = await db
      .select({ todayCount: count() })
      .from(visits)
      .where(eq(visits.visitDate, visitDate));

    const now = Date.now();
    const baseSeq = (todayCount as number) + 1;

    const newVisit = {
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      patientId,
      doctorId,
      visitDate,
      chiefComplaint: chiefComplaint || null,
      doctorNotes: doctorNotes || null,
      diagnosis: null,
      appointmentId: appointmentId || null,
      visitType: visitType || "WALKIN",
      status: "OPEN" as const,
      totalAmount: 0,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Retry loop to handle UNIQUE constraint violations on visitCode
    let visitCode = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      visitCode = generateVisitCode(visitDate, baseSeq + attempt);
      try {
        await db.insert(visits).values({ ...newVisit, visitCode });
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt === 4 || !msg.includes('UNIQUE')) throw e;
      }
    }

    return NextResponse.json({ visit: { ...newVisit, visitCode } }, { status: 201 });
  } catch (error) {
    console.error("Create visit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
