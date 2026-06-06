import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens, users } from "@/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`verify-email-otp:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many verification attempts. Please wait." }, { status: 429 });
  }

  const log = logger.forRoute("POST /api/staff/verify-email-otp");
  try {
    const body = await request.json() as { userId?: unknown; code?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : null;
    const code = typeof body.code === "string" ? body.code.trim() : null;

    if (!userId || !code) {
      return NextResponse.json({ error: "User ID and code are required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    const [user] = await db
      .select({ id: users.id, isActive: users.isActive, isVerified: users.isVerified })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isActive === 1 && user.isVerified === 1) {
      return NextResponse.json({ error: "Account already verified" }, { status: 400 });
    }

    const [tokenRecord] = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, "EMAIL"),
          eq(verificationTokens.code, code),
          eq(verificationTokens.used, 0)
        )
      );

    if (!tokenRecord || tokenRecord.expiresAt < now) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
    }

    await db.update(verificationTokens).set({ used: 1 }).where(eq(verificationTokens.id, tokenRecord.id));

    log.info("Staff email OTP verified", { userId });
    return NextResponse.json({ verified: true });
  } catch (error) {
    log.error("Verify email OTP error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
