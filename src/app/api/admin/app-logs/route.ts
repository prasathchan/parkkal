/**
 * GET /api/admin/app-logs
 *
 * Paginated query of the app_logs table.
 * ADMIN only — non-admins receive 403.
 *
 * Query params:
 *   offset  — pagination offset (default 0)
 *   level   — filter by level: 'error' | 'security' | 'warn' (default all)
 *   route   — filter by route substring match (case-insensitive LIKE)
 *   since   — Unix ms; only entries after this timestamp
 *   until   — Unix ms; only entries before this timestamp
 *   sort    — 'asc' | 'desc' (default 'desc')
 *   search  — freetext substring match on message field
 */
import { eq, and, gte, lte, like, desc, asc } from "drizzle-orm";
import { appLogs } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

const LIMIT = 50;

export const GET = withRoute(
  { route: "GET /api/admin/app-logs", rateLimit: RATE_LIMITS.READ, adminOnly: true },
  async (req, { session, db }) => {
    const url    = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
    const level  = url.searchParams.get("level") ?? "";
    const route  = url.searchParams.get("route") ?? "";
    const search = url.searchParams.get("search") ?? "";
    const since  = url.searchParams.get("since")  ? parseInt(url.searchParams.get("since")!,  10) : null;
    const until  = url.searchParams.get("until")  ? parseInt(url.searchParams.get("until")!,  10) : null;
    const sortDir = url.searchParams.get("sort") === "asc" ? "asc" : "desc";

    const conditions = [eq(appLogs.organizationId, session.orgId)];
    if (level)  conditions.push(eq(appLogs.level,   level));
    if (route)  conditions.push(like(appLogs.route,   `%${route}%`));
    if (search) conditions.push(like(appLogs.message, `%${search}%`));
    if (since && !Number.isNaN(since)) conditions.push(gte(appLogs.createdAt, since));
    if (until && !Number.isNaN(until)) conditions.push(lte(appLogs.createdAt, until));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(appLogs)
      .where(where)
      .orderBy(sortDir === "asc" ? asc(appLogs.createdAt) : desc(appLogs.createdAt))
      .limit(LIMIT)
      .offset(offset);

    return apiOk({
      logs: rows.map((r: typeof rows[number]) => ({
        ...r,
        data: r.data ? JSON.parse(r.data) as Record<string, unknown> : null,
      })),
      hasMore: rows.length === LIMIT,
    });
  }
);
