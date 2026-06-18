import { eq, and } from "drizzle-orm";
import { locations, staffLocationAssignments, users, organizationMembers } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const assignSchema = z.object({
  userId:    z.string().min(1),
  isPrimary: z.number().int().min(0).max(1).optional().default(0),
});

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/locations/[id]/staff", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.APPOINTMENTS_CREATE },
  async (_req, { session, db }, { id: locationId }) => {
    const [loc] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.organizationId, session.orgId)));

    if (!loc) return apiError("Location not found", 404);

    const assignments = await db
      .select({
        id: staffLocationAssignments.id,
        userId: staffLocationAssignments.userId,
        locationId: staffLocationAssignments.locationId,
        isPrimary: staffLocationAssignments.isPrimary,
        createdAt: staffLocationAssignments.createdAt,
        userName: users.name,
      })
      .from(staffLocationAssignments)
      .leftJoin(users, eq(users.id, staffLocationAssignments.userId))
      .where(
        and(
          eq(staffLocationAssignments.locationId, locationId),
          eq(staffLocationAssignments.organizationId, session.orgId)
        )
      );

    return apiOk({ assignments });
  }
);

export const POST = withRoute<{ id: string }>(
  { route: "POST /api/locations/[id]/staff", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.LOCATIONS_MANAGE },
  async (req, { session, db }, { id: locationId }) => {
    const body = assignSchema.safeParse(await req.json());
    if (!body.success) return apiError("Invalid assignment data", 422);

    const [loc] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.organizationId, session.orgId)));

    if (!loc) return apiError("Location not found", 404);

    const [member] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, body.data.userId),
          eq(organizationMembers.organizationId, session.orgId)
        )
      );

    if (!member) return apiError("Staff member not found in this organisation", 404);

    await db
      .insert(staffLocationAssignments)
      .values({
        id: generateId(),
        userId: body.data.userId,
        organizationId: session.orgId,
        locationId,
        isPrimary: body.data.isPrimary ?? 0,
        createdAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: [staffLocationAssignments.userId, staffLocationAssignments.locationId],
        set: { isPrimary: body.data.isPrimary ?? 0 },
      });

    return apiOk({ assigned: true });
  }
);

export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/locations/[id]/staff", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.LOCATIONS_MANAGE },
  async (req, { session, db }, { id: locationId }) => {
    const { userId } = await req.json() as { userId: string };
    if (!userId) return apiError("userId is required", 422);

    const [loc] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.organizationId, session.orgId)));

    if (!loc) return apiError("Location not found", 404);

    await db.delete(staffLocationAssignments).where(
      and(
        eq(staffLocationAssignments.locationId, locationId),
        eq(staffLocationAssignments.userId, userId),
        eq(staffLocationAssignments.organizationId, session.orgId)
      )
    );

    return apiOk({ removed: true });
  }
);
