/**
 * GET /api/calendar/status
 * Returns which calendars the current user has connected.
 */
import { eq, and } from "drizzle-orm";
import { calendarIntegrations } from "@/db/schema";
import { withRoute, apiOk } from "@/lib/api";

export const GET = withRoute(
  { route: "GET /api/calendar/status" },
  async (_req, { session, db }) => {
    const rows = await db
      .select({ provider: calendarIntegrations.provider, isActive: calendarIntegrations.isActive, updatedAt: calendarIntegrations.updatedAt })
      .from(calendarIntegrations)
      .where(and(eq(calendarIntegrations.userId, session.userId), eq(calendarIntegrations.isActive, 1)));

    type Row = (typeof rows)[number];
    return apiOk({
      google:  rows.some((r: Row) => r.provider === "GOOGLE"),
      outlook: rows.some((r: Row) => r.provider === "OUTLOOK"),
    });
  },
);
