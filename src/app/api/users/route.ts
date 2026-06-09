import { eq, and } from "drizzle-orm";
import { users, organizationMembers } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

/** GET /api/users — list active members in the org with their role */
export const GET = withRoute(
  { route: "GET /api/users", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }) => {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.isActive, 1)));

    return apiOk({ users: rows });
  }
);
