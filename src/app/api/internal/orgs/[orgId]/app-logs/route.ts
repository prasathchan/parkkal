/**
 * GET /api/internal/orgs/[orgId]/app-logs
 * Pricing Console S2S — paginated app logs for one org.
 * Auth = Bearer INTERNAL_API_KEY.
 *
 * Query params: offset, level, route, search, since, until, sort (same as admin route)
 */
import { eq, and, gte, lte, like, desc, asc } from "drizzle-orm";
import { appLogs, organizations } from "@/db/schema";
import { withInternalRoute, internalOk, internalError } from "@/lib/internal-api";

const LIMIT = 50;

export const GET = withInternalRoute<{ orgId: string }>(
  "GET /api/internal/orgs/[orgId]/app-logs",
  async (req, { db }, { orgId }) => {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId));
    if (!org) return internalError("Org not found", 404);

    const url     = new URL(req.url);
    const offset  = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
    const level   = url.searchParams.get("level")  ?? "";
    const route   = url.searchParams.get("route")  ?? "";
    const search  = url.searchParams.get("search") ?? "";
    const since   = url.searchParams.get("since")  ? parseInt(url.searchParams.get("since")!,  10) : null;
    const until   = url.searchParams.get("until")  ? parseInt(url.searchParams.get("until")!,  10) : null;
    const sortDir = url.searchParams.get("sort") === "asc" ? "asc" : "desc";

    const conditions = [eq(appLogs.organizationId, orgId)];
    if (level)  conditions.push(eq(appLogs.level,    level));
    if (route)  conditions.push(like(appLogs.route,   `%${route}%`));
    if (search) conditions.push(like(appLogs.message, `%${search}%`));
    if (since && !Number.isNaN(since)) conditions.push(gte(appLogs.createdAt, since));
    if (until && !Number.isNaN(until)) conditions.push(lte(appLogs.createdAt, until));

    const rows = await db
      .select()
      .from(appLogs)
      .where(and(...conditions))
      .orderBy(sortDir === "asc" ? asc(appLogs.createdAt) : desc(appLogs.createdAt))
      .limit(LIMIT)
      .offset(offset);

    type Row = (typeof rows)[number];
    return internalOk({
      logs: rows.map((r: Row) => ({
        ...r,
        data: r.data ? (JSON.parse(r.data) as Record<string, unknown>) : null,
      })),
      hasMore: rows.length === LIMIT,
    });
  }
);
