import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens, users } from "@/db/schema";
import { hashOTP } from "@/lib/otp";
import { sendEmailOTP } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const ACTIVATION_WINDOW_MS = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`email-otp:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many OTP requests. Please wait before trying again." }, { status: 429 });
  }

  const log = logger.forRoute("POST /api/staff/send-email-otp");
  try {
    const body = await request.json() as { userId?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : null;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, isActive: users.isActive, isVerified: users.isVerified })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Allow only users in activation flow: inactive (Mode 1) or active-but-unverified (Mode 3)
    if (user.isActive === 1 && user.isVerified === 1) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Require proof that activation token was recently used (prevents arbitrary email OTP spam)
    const windowStart = now - ACTIVATION_WINDOW_MS;
    const [recentInvite] = await db
      .select({ id: verificationTokens.id })
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, "STAFF_INVITE"),
          eq(verificationTokens.used, 1),
          gt(verificationTokens.expiresAt, windowStart)
        )
      );

    if (!recentInvite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Invalidate any existing email OTPs for this user
    await db.delete(verificationTokens)
      .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.type, "EMAIL")));

    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const sixDigit = String(100000 + (buf[0] % 900000));
    const sixDigitHash = await hashOTP(sixDigit);

    await db.insert(verificationTokens).values({
      id: `vt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      userId,
      type: "EMAIL",
      code: sixDigitHash,
      expiresAt: now + 15 * 60 * 1000,
      used: 0,
      createdAt: now,
    });

    try {
      await sendEmailOTP(user.email, user.name, sixDigit); // plaintext sent to user, hash stored in DB
    } catch (err) {
      log.warn("Failed to send staff email OTP", { userId, error: String(err) });
    }

    log.info("Staff email OTP sent", { userId });
    const masked = user.email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
    return NextResponse.json({ sent: true, maskedEmail: masked });
  } catch (error) {
    log.error("Send email OTP error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
