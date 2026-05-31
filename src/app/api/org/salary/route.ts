import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { salaryRecords, organizationMembers, users, appointments } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

  const db = getDb();
  const records = await db
    .select({
      id: salaryRecords.id,
      userId: salaryRecords.userId,
      month: salaryRecords.month,
      salaryAmount: salaryRecords.salaryAmount,
      salaryType: salaryRecords.salaryType,
      appointmentCount: salaryRecords.appointmentCount,
      paidAmount: salaryRecords.paidAmount,
      paidAt: salaryRecords.paidAt,
      status: salaryRecords.status,
      notes: salaryRecords.notes,
      userName: users.name,
      userEmail: users.email,
    })
    .from(salaryRecords)
    .innerJoin(users, eq(salaryRecords.userId, users.id))
    .where(and(eq(salaryRecords.organizationId, session.orgId), eq(salaryRecords.month, month)))
    ;

  return NextResponse.json({ records, month });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const month = body.month || new Date().toISOString().slice(0, 7);

    const db = getDb();
    const now = Date.now();

    // Get all active members
    const members = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.isActive, 1)))
      ;

    const [year, mon] = month.split("-").map(Number);
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;

    const created = [];
    for (const member of members) {
      // Skip if already exists
      const existing = (await db
        .select()
        .from(salaryRecords)
        .where(and(eq(salaryRecords.organizationId, session.orgId), eq(salaryRecords.userId, member.userId), eq(salaryRecords.month, month)))
        )[0];

      if (existing) continue;

      let apptCount = 0;
      let totalSalary = member.salaryAmount;

      if (member.salaryType === "PER_APPOINTMENT") {
        const appts = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, session.orgId),
              eq(appointments.doctorId, member.userId)
            )
          )
          ;
        // Filter by month
        apptCount = appts.filter(a => a.appointmentDate >= monthStart && a.appointmentDate <= monthEnd && a.status === "COMPLETED").length;
        totalSalary = member.salaryAmount * apptCount;
      }

      const record = {
        id: crypto.randomUUID(),
        organizationId: session.orgId,
        userId: member.userId,
        month,
        salaryAmount: totalSalary,
        salaryType: member.salaryType,
        appointmentCount: apptCount,
        paidAmount: 0,
        paidAt: null,
        status: "PENDING" as const,
        notes: null,
        createdAt: now,
      };

      await db.insert(salaryRecords).values(record);
      created.push(record);
    }

    return NextResponse.json({ created: created.length, month });
  } catch (error) {
    console.error("Generate salary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
