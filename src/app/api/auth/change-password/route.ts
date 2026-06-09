import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";
import { withRoute, apiOk, apiError } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, "New password must be at least 8 characters")
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must contain at least one letter and one number"),
});

/** POST /api/auth/change-password — update the authenticated user's password */
export const POST = withRoute(
  {
    route: "POST /api/auth/change-password",
    rateLimit: { limit: 5, windowMs: 15 * 60_000 },
    // Key by IP + userId so that different users sharing an IP don't exhaust each other's quota
    rateLimitKey: (session, req) => `change-password:${getClientIp(req)}:${session.userId}`,
  },
  async (req, { session, db, log }) => {
    const body = await req.json();
    const { currentPassword, newPassword } = schema.parse(body);

    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!user) return apiError("User not found", 404);

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      log.security("Change password failed: incorrect current password", { userId: session.userId });
      return apiError("Current password is incorrect", 400);
    }

    if (currentPassword === newPassword) {
      return apiError("New password must be different from current password", 400);
    }

    const newHash = await hashPassword(newPassword);
    await db.update(users)
      .set({ passwordHash: newHash, updatedAt: Date.now() })
      .where(eq(users.id, session.userId));

    log.info("Password changed successfully", { userId: session.userId });
    return apiOk({ success: true });
  }
);
