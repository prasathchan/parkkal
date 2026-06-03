import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, count, like, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits, patients, users, organizations, organizationPatients, organizationMembers, appointments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const createVisitSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "visitDate must be YYYY-MM-DD"),
  chiefComplaint: z.string().optional(),
  doctorNotes: z.string().optional(),
  appointmentId: z.string().nullable().optional(),
  visitType: z.enum(["APPOINTMENT", "WALKIN"]).default("WALKIN"),
});

function generateVisitCode(date: string, seq: number): string {
  const d = date.replace(/-/g, "");
  return `VIS-${d}-${String(seq).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  // RBAC: DOCTOR role may only see their own visits.
  const doctorId = session.role === "DOCTOR" ? session.userId : searchParams.get("doctorId");
  const status = searchParams.get("status");
  const date = searchParams.get("date");
  const search = searchParams.get("search");

  const db = getDb();

  const conditions = [eq(visits.organizationId, session.orgId)];
  if (patientId) conditions.push(eq(visits.patientId, patientId));
  if (doctorId) conditions.push(eq(visits.doctorId, doctorId));
  if (status) conditions.push(eq(visits.status, status as "OPEN" | "COMPLETED" | "CANCELLED"));
  if (date) conditions.push(eq(visits.visitDate, date));
  if (search) {
    const likeSearch = `%${search}%`;
    const searchCondition = or(like(patients.name, likeSearch), like(visits.visitCode, likeSearch));
    if (searchCondition) conditions.push(searchCondition);
  }

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
    .where(and(...conditions))
    .orderBy(desc(visits.createdAt));

  return NextResponse.json({ visits: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createVisitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
    }
    const { patientId, visitDate, chiefComplaint, doctorNotes, appointmentId, visitType } = parsed.data;
    // RBAC: DOCTOR role can only create visits for themselves
    const doctorId = session.role === "DOCTOR" ? session.userId : parsed.data.doctorId;

    const db = getDb();

    const [orgExists] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, session.orgId));
    if (!orgExists) return NextResponse.json({ error: "Organization not found" }, { status: 400 });

    const [patientOrgLink] = await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patientId)));
    if (!patientOrgLink) return NextResponse.json({ error: "Patient does not belong to this organization" }, { status: 400 });

    // Verify doctor is a member of this org
    const [doctorMembership] = await db.select({ userId: organizationMembers.userId }).from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, doctorId)));
    if (!doctorMembership) return NextResponse.json({ error: "Doctor does not belong to this organization" }, { status: 400 });

    // Prevent duplicate visits for the same appointment
    if (appointmentId) {
      const [existing] = await db.select({ id: visits.id }).from(visits)
        .where(and(eq(visits.appointmentId, appointmentId), eq(visits.organizationId, session.orgId)));
      if (existing) return NextResponse.json({ error: "A visit already exists for this appointment", visitId: existing.id }, { status: 409 });
    }
    // Count org-scoped visits today for sequential visit code
    const [{ todayCount }] = await db
      .select({ todayCount: count() })
      .from(visits)
      .where(and(eq(visits.organizationId, session.orgId), eq(visits.visitDate, visitDate)));

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

    // Retry loop for UNIQUE constraint on visitCode
    let visitCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      visitCode = generateVisitCode(visitDate, baseSeq + attempt);
      try {
        await db.insert(visits).values({ ...newVisit, visitCode });
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt === 4 || !msg.includes("UNIQUE")) throw e;
      }
    }

    // Mark linked appointment as IN_PROGRESS (best-effort — old DBs without this status are tolerated)
    if (appointmentId) {
      try {
        await db
          .update(appointments)
          .set({ status: "IN_PROGRESS" })
          .where(and(eq(appointments.id, appointmentId), eq(appointments.organizationId, session.orgId)));
      } catch {
        // DB schema not yet migrated — skip silently
      }
    }

    return NextResponse.json({ visit: { ...newVisit, visitCode } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    console.error("Create visit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
