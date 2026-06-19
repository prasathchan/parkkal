import { eq } from "drizzle-orm";
import { users, organizationMembers } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { encryptField, decryptField } from "@/lib/encryption";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

/** PATCH /api/users/[id] — update a user's profile (self or ADMIN only) */
export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/users/[id]", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }, { id }) => {
    const isSelf = session.userId === id;

    if (!isSelf) {
      if (session.role !== "ADMIN") {
        log.security("Permission denied: only ADMIN can update other users", { targetUserId: id, role: session.role });
        return apiError("Forbidden", 403);
      }
      // Verify the target user belongs to this org
      const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, id));
      if (!membership || membership.organizationId !== session.orgId) return apiError("Forbidden", 403);
    }

    const data = updateSchema.parse(await req.json());
    const encrypted = {
      ...data,
      dateOfBirth: data.dateOfBirth !== undefined ? (await encryptField(data.dateOfBirth) ?? null) : undefined,
      address:     data.address     !== undefined ? (await encryptField(data.address) ?? null)     : undefined,
    };
    await db.update(users).set({ ...encrypted, updatedAt: Date.now() }).where(eq(users.id, id));

    const [updated] = await db
      .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, dateOfBirth: users.dateOfBirth, gender: users.gender, address: users.address })
      .from(users)
      .where(eq(users.id, id));

    log.info("User profile updated", { targetUserId: id });
    return apiOk({ user: {
      ...updated,
      dateOfBirth: await decryptField(updated.dateOfBirth) ?? null,
      address:     await decryptField(updated.address) ?? null,
    } });
  }
);
