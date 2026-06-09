import { eq, and } from "drizzle-orm";
import { users, organizationMembers } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

/**
 * GET /api/users — list active members in the org with their role.
 *
 * No explicit `permission` is declared here intentionally.
 * withRoute() still enforces a valid org session (JWT present, org active,
 * member active, token not revoked) — the only gate we need for this
 * endpoint because:
 *   1. The response is scoped to session.orgId, so cross-org leakage is
 *      impossible.
 *   2. The payload is non-sensitive (id, name, email, role — no PHI such
 *      as phone, DOB, national IDs, or salary data).
 *   3. Several roles (e.g. DOCTOR, NURSE, RECEPTIONIST) need the member
 *      list to populate dropdowns (appointment doctor picker, etc.) and
 *      must not be blocked by a staff.view permission gate.
 *
 * If this endpoint is ever extended to return sensitive fields, add
 * `permission: PERMISSIONS.STAFF_VIEW` at that point.
 */
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
