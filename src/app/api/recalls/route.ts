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
import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, count, isNotNull, gte, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits, patients, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const READ_RATE_LIMIT = { limit: 300, windowMs: 60_000 };

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`read:${session.userId}`, READ_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("GET /api/recalls", session);

  if (!await hasPermission(session, PERMISSIONS.VISITS_VIEW)) {
    log.security("Permission denied: VISITS_VIEW required for recalls", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all"; // "upcoming" | "overdue" | "all"
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const db = getDb();

  try {
    const statusFilter =
      status === "upcoming" ? gte(visits.recallDate, today) :
      status === "overdue"  ? lt(visits.recallDate, today) :
      undefined;

    const whereClause = and(
      eq(visits.organizationId, session.orgId),
      isNotNull(visits.recallDate),
      statusFilter,
    );

    const [{ total }] = await db
      .select({ total: count() })
      .from(visits)
      .where(whereClause);

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
      .where(whereClause)
      .orderBy(desc(visits.recallDate))
      .limit(limit)
      .offset(offset);

    type RecallRow = (typeof rows)[number];
    // Tag each row as overdue or upcoming
    const tagged = rows.map((r: RecallRow) => ({
      ...r,
      isOverdue: r.recallDate !== null && r.recallDate < today,
      daysUntilRecall: r.recallDate
        ? Math.round(
            (new Date(r.recallDate).getTime() - new Date(today).getTime()) / 86_400_000
          )
        : null,
    }));

    return NextResponse.json({ recalls: tagged, total, hasMore: offset + rows.length < total });
  } catch (err) {
    log.error("Failed to fetch recalls", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
