import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import { salaryRecords, organizationMembers, users, appointments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

/** GET /api/org/salary?month=YYYY-MM — list salary records for a month */
export const GET = withRoute(
  { route: "GET /api/org/salary", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.SALARY_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const rawMonth = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(rawMonth)) return apiError("Invalid month format. Use YYYY-MM", 400);

    const records = await db
      .select({
        id: salaryRecords.id, userId: salaryRecords.userId, month: salaryRecords.month,
        salaryAmount: salaryRecords.salaryAmount, salaryType: salaryRecords.salaryType,
        appointmentCount: salaryRecords.appointmentCount, paidAmount: salaryRecords.paidAmount,
        paidAt: salaryRecords.paidAt, status: salaryRecords.status, notes: salaryRecords.notes,
        userName: users.name, userEmail: users.email,
      })
      .from(salaryRecords)
      .innerJoin(users, eq(salaryRecords.userId, users.id))
      .where(and(eq(salaryRecords.organizationId, session.orgId), eq(salaryRecords.month, rawMonth)));

    return apiOk({ records, month: rawMonth });
  }
);

/** POST /api/org/salary — generate salary records for a month (idempotent) */
export const POST = withRoute(
  { route: "POST /api/org/salary", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.SALARY_MANAGE },
  async (req, { session, db, log }) => {
    const body = await req.json() as Record<string, unknown>;
    const rawMonth = (body.month as string | undefined) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(rawMonth)) return apiError("Invalid month format. Use YYYY-MM", 400);
    const month = rawMonth;

    const now = Date.now();
    const members = await db.select().from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.isActive, 1)));

    if (members.length === 0) return apiOk({ created: 0, month });

    type MemberRow = (typeof members)[number];
    const memberUserIds = members.map((m: MemberRow) => m.userId);

    // Skip members that already have a record for this month (idempotent)
    const existingRecords = await db.select({ userId: salaryRecords.userId }).from(salaryRecords)
      .where(and(eq(salaryRecords.organizationId, session.orgId), eq(salaryRecords.month, month), inArray(salaryRecords.userId, memberUserIds)));
    const alreadyGenerated = new Set(existingRecords.map((r: { userId: string }) => r.userId));
    const newMembers = members.filter((m: MemberRow) => !alreadyGenerated.has(m.userId));

    if (newMembers.length === 0) return apiOk({ created: 0, month });

    const [year, mon] = month.split("-").map(Number);
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(new Date(year, mon, 0).getDate()).padStart(2, "0")}`;

    // Bulk fetch appointment counts for PER_APPOINTMENT members
    const perApptUserIds = newMembers.filter((m: MemberRow) => m.salaryType === "PER_APPOINTMENT").map((m: MemberRow) => m.userId);
    const apptCountMap: Record<string, number> = {};
    if (perApptUserIds.length > 0) {
      const apptRows = await db
        .select({ doctorId: appointments.doctorId, count: sql<number>`count(*)` })
        .from(appointments)
        .where(and(eq(appointments.organizationId, session.orgId), inArray(appointments.doctorId, perApptUserIds), eq(appointments.status, "COMPLETED"), gte(appointments.appointmentDate, monthStart), lte(appointments.appointmentDate, monthEnd)))
        .groupBy(appointments.doctorId);
      for (const row of apptRows) { if (row.doctorId) apptCountMap[row.doctorId] = Number(row.count); }
    }

    const created = [];
    for (const member of newMembers) {
      const apptCount = member.salaryType === "PER_APPOINTMENT" ? (apptCountMap[member.userId] ?? 0) : 0;
      const totalSalary = member.salaryType === "PER_APPOINTMENT" ? member.salaryAmount * apptCount : member.salaryAmount;

      const record = { id: crypto.randomUUID(), organizationId: session.orgId, userId: member.userId, month, salaryAmount: totalSalary, salaryType: member.salaryType, appointmentCount: apptCount, paidAmount: 0, paidAt: null, status: "PENDING" as const, notes: null, createdAt: now };
      await db.insert(salaryRecords).values(record);
      created.push(record);
    }

    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "SALARY_GENERATED", targetType: "salary", metadata: { month, count: created.length } });
    log.info("Salary records generated", { month, created: created.length });
    return apiOk({ created: created.length, month });
  }
);
