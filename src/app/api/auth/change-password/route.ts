import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth-edge";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters").regex(
    /^(?=.*[A-Za-z])(?=.*\d).+$/,
    "Password must contain at least one letter and one number"
  ),
});

const RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/auth/change-password", session);

  const ip = getClientIp(request);
  const rl = await checkRateLimit(`change-password:${ip}:${session.userId}`, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = schema.parse(body);

    const db = getDb();
    const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash })
      .from(users).where(eq(users.id, session.userId));

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      log.security("Change password failed: incorrect current password", { userId: session.userId });
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "New password must be different from current password" }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await db.update(users)
      .set({ passwordHash: newHash, updatedAt: Date.now() })
      .where(eq(users.id, session.userId));

    log.info("Password changed successfully", { userId: session.userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    log.error("Failed to change password", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
