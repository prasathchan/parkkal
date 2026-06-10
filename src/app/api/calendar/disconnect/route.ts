/**
 * POST /api/calendar/disconnect
 * Disconnects a calendar integration for the current user.
 * Body: { provider: "GOOGLE" | "OUTLOOK" }
 */
import { eq, and } from "drizzle-orm";
import { calendarIntegrations } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ provider: z.enum(["GOOGLE", "OUTLOOK"]) });

export const POST = withRoute(
  { route: "POST /api/calendar/disconnect", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db }) => {
    const { provider } = schema.parse(await req.json());
    const [row] = await db
      .select({ id: calendarIntegrations.id })
      .from(calendarIntegrations)
      .where(and(eq(calendarIntegrations.userId, session.userId), eq(calendarIntegrations.provider, provider)));

    if (!row) return apiError("No integration found", 404);

    await db
      .update(calendarIntegrations)
      .set({ isActive: 0, updatedAt: Date.now() })
      .where(eq(calendarIntegrations.id, row.id));

    return apiOk({ success: true });
  },
);
