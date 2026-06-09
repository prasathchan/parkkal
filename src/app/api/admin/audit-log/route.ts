import { eq, desc, and, gte } from "drizzle-orm";
import { adminAuditLog, users } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

const LIMIT = 50;

/**
 * GET /api/admin/audit-log
 *
 * Returns paginated audit log entries for the caller's org. ADMIN only.
 *
 * Query params:
 *   offset  — pagination offset (default 0)
 *   action  — filter by action string (optional)
 *   since   — Unix ms timestamp; only entries after this (optional)
 */
export const GET = withRoute(
  { route: "GET /api/admin/audit-log", rateLimit: RATE_LIMITS.READ, adminOnly: true },
  async (req, { session, db }) => {
    const url = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
    const actionFilter = url.searchParams.get("action") ?? "";
    const since = url.searchParams.get("since") ? parseInt(url.searchParams.get("since")!, 10) : null;

    const conditions = [eq(adminAuditLog.organizationId, session.orgId)];
    if (actionFilter) conditions.push(eq(adminAuditLog.action, actionFilter));
    if (since && !Number.isNaN(since)) conditions.push(gte(adminAuditLog.createdAt, since));

    const rows = await db
      .select({
        id: adminAuditLog.id,
        action: adminAuditLog.action,
        actorId: adminAuditLog.actorId,
        actorRole: adminAuditLog.actorRole,
        actorName: users.name,
        targetType: adminAuditLog.targetType,
        targetId: adminAuditLog.targetId,
        metadata: adminAuditLog.metadata,
        createdAt: adminAuditLog.createdAt,
      })
      .from(adminAuditLog)
      .leftJoin(users, eq(adminAuditLog.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(LIMIT)
      .offset(offset);

    return apiOk({
      entries: rows.map((r: typeof rows[number]) => ({
        ...r,
        metadata: r.metadata ? JSON.parse(r.metadata) as Record<string, unknown> : null,
      })),
      hasMore: rows.length === LIMIT,
    });
  }
);
