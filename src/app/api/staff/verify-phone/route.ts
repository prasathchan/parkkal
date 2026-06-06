import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens, users, organizationMembers } from "@/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  // Rate limit: 10 OTP verify attempts per IP per 15 minutes
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`verify-otp:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please wait before trying again." },
      { status: 429 }
    );
  }

  const log = logger.forRoute("POST /api/staff/verify-phone");
  try {
    const body = await request.json() as { userId?: string; code?: string };
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: "User ID and code are required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    // Guard: allow Mode 1 (isActive=0) and Mode 3 (isActive=1, isVerified=0)
    const [targetUser] = await db
      .select({ id: users.id, isActive: users.isActive, isVerified: users.isVerified })
      .from(users)
      .where(eq(users.id, userId));
    if (!targetUser || (targetUser.isActive === 1 && targetUser.isVerified === 1)) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
    }

    const [tokenRecord] = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, "PHONE_OTP"),
          eq(verificationTokens.code, code),
          eq(verificationTokens.used, 0)
        )
      );

    if (!tokenRecord || tokenRecord.expiresAt < now) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
    }

    await db.update(users)
      .set({ isActive: 1, isVerified: 1, updatedAt: now })
      .where(eq(users.id, userId));

    // For Mode 1 (was inactive), activate the member record too.
    // For Mode 3 (already active), member record stays as-is (portal_access=0 preserved).
    if (targetUser.isActive === 0) {
      await db.update(organizationMembers)
        .set({ isActive: 1 })
        .where(eq(organizationMembers.userId, userId));
    }

    await db.update(verificationTokens)
      .set({ used: 1 })
      .where(eq(verificationTokens.id, tokenRecord.id));

    log.info("Staff phone verified and account activated", { userId });
    return NextResponse.json({ activated: true });
  } catch (error) {
    log.error("Verify phone error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
