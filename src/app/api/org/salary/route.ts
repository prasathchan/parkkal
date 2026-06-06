import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { salaryRecords, organizationMembers, users, appointments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SALARY_VIEW))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const rawMonth = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(rawMonth)) {
    return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
  }
  const month = rawMonth;

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
  if (!(await hasPermission(session, PERMISSIONS.SALARY_MANAGE))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const rawMonth = (body.month as string | undefined) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(rawMonth)) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }
    const month = rawMonth;

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
    const lastDay = new Date(year, mon, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const created = [];

    if (members.length === 0) return NextResponse.json({ created: 0, month });

    type MemberRow = (typeof members)[number];

    const memberUserIds = members.map((m: MemberRow) => m.userId);

    // Bulk fetch already-generated records for this month — avoids N+1 existence checks
    const existingRecords = await db
      .select({ userId: salaryRecords.userId })
      .from(salaryRecords)
      .where(and(
        eq(salaryRecords.organizationId, session.orgId),
        eq(salaryRecords.month, month),
        inArray(salaryRecords.userId, memberUserIds)
      ));
    const alreadyGeneratedSet = new Set(existingRecords.map((r: { userId: string }) => r.userId));

    const newMembers = members.filter((m: MemberRow) => !alreadyGeneratedSet.has(m.userId));
    if (newMembers.length === 0) return NextResponse.json({ created: 0, month });

    // Bulk fetch appointment counts for PER_APPOINTMENT members — one query instead of N
    const perApptUserIds = newMembers
      .filter((m: MemberRow) => m.salaryType === "PER_APPOINTMENT")
      .map((m: MemberRow) => m.userId);

    const apptCountMap: Record<string, number> = {};
    if (perApptUserIds.length > 0) {
      const apptRows = await db
        .select({
          doctorId: appointments.doctorId,
          count: sql<number>`count(*)`,
        })
        .from(appointments)
        .where(and(
          eq(appointments.organizationId, session.orgId),
          inArray(appointments.doctorId, perApptUserIds),
          eq(appointments.status, "COMPLETED"),
          gte(appointments.appointmentDate, monthStart),
          lte(appointments.appointmentDate, monthEnd)
        ))
        .groupBy(appointments.doctorId);
      for (const row of apptRows) {
        if (row.doctorId) apptCountMap[row.doctorId] = Number(row.count);
      }
    }

    for (const member of newMembers) {
      const apptCount = member.salaryType === "PER_APPOINTMENT" ? (apptCountMap[member.userId] ?? 0) : 0;
      const totalSalary = member.salaryType === "PER_APPOINTMENT"
        ? member.salaryAmount * apptCount
        : member.salaryAmount;

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
