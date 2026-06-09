/**
 * API Route: /api/recalls
 *
 * GET — List visits with a recall date set (upcoming + overdue).
 *
 * Query params:
 *   status = "upcoming" | "overdue" | "all"  (default: "all")
 *   limit, offset
 *
 * Who can call this: any staff with visits.view permission
 */
import { eq, and, desc, count, isNotNull, gte, lt } from "drizzle-orm";
import { visits, patients, users } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

export const GET = withRoute(
  { route: "GET /api/recalls", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.VISITS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "all";
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const offset = Number(searchParams.get("offset") ?? 0);
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const statusFilter =
      status === "upcoming" ? gte(visits.recallDate, today) :
      status === "overdue"  ? lt(visits.recallDate, today) :
      undefined;

    const where = and(eq(visits.organizationId, session.orgId), isNotNull(visits.recallDate), statusFilter);

    const [{ total }] = await db.select({ total: count() }).from(visits).where(where);

    const rows = await db
      .select({
        id: visits.id,
        visitCode: visits.visitCode,
        visitDate: visits.visitDate,
        recallDate: visits.recallDate,
        recallNotes: visits.recallNotes,
        status: visits.status,
        patientId: visits.patientId,
        patientName: patients.name,
        patientCode: patients.patientCode,
        patientPhone: patients.phone,
        doctorName: users.name,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.patientId, patients.id))
      .leftJoin(users, eq(visits.doctorId, users.id))
      .where(where)
      .orderBy(desc(visits.recallDate))
      .limit(limit)
      .offset(offset);

    type RecallRow = (typeof rows)[number];
    // Tag each row as overdue or upcoming for the UI
    const tagged = rows.map((r: RecallRow) => ({
      ...r,
      isOverdue: r.recallDate !== null && r.recallDate < today,
      daysUntilRecall: r.recallDate
        ? Math.round((new Date(r.recallDate).getTime() - new Date(today).getTime()) / 86_400_000)
        : null,
    }));

    return apiOk({ recalls: tagged, total, hasMore: offset + rows.length < total });
  }
);
