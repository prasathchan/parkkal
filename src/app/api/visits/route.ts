import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits, patients, users } from "@/db/schema";
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
    const { patientId, doctorId, visitDate, chiefComplaint, doctorNotes } = body;

    if (!patientId || !doctorId || !visitDate) {
      return NextResponse.json({ error: "patientId, doctorId, visitDate are required" }, { status: 400 });
    }

    const db = getDb();

    // Count today's visits for sequence
    const [{ todayCount }] = await db
      .select({ todayCount: count() })
      .from(visits)
      .where(eq(visits.visitDate, visitDate));

    const seq = (todayCount as number) + 1;
    const visitCode = generateVisitCode(visitDate, seq);
    const now = Date.now();

    const newVisit = {
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      visitCode,
      patientId,
      doctorId,
      visitDate,
      chiefComplaint: chiefComplaint || null,
      doctorNotes: doctorNotes || null,
      diagnosis: null,
      status: "OPEN" as const,
      totalAmount: 0,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(visits).values(newVisit);
    return NextResponse.json({ visit: newVisit }, { status: 201 });
  } catch (error) {
    console.error("Create visit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
