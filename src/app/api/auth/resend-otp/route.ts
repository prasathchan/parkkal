import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users, verificationTokens } from "@/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hashOTP } from "@/lib/otp";
import { sendEmailOTP, sendPhoneVerificationEmail } from "@/lib/email";
import { sendSMSOTP } from "@/lib/sms";
import { logger } from "@/lib/logger";

const resendSchema = z.object({
  userId: z.string(),
  type: z.enum(["EMAIL", "PHONE"] as const),
});

const RESEND_USER_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }; // 3 per hour per userId
const RESEND_IP_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };  // 10 per hour per IP

function generateOTP(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

export async function POST(request: NextRequest) {
  // IP-level gate first — prevents userId enumeration via cycling IDs
  const ip = getClientIp(request);
  const ipRl = await checkRateLimit(`resend-otp-ip:${ip}`, RESEND_IP_LIMIT);
  if (!ipRl.allowed) {
    const retryAfter = Math.ceil((ipRl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many resend attempts. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const log = logger.forRoute("POST /api/auth/resend-otp");
  try {
    const body = await request.json();
    const { userId, type } = resendSchema.parse(body);

    // Per-user rate limit as secondary guard
    const rl = await checkRateLimit(`resend-otp:${userId}:${type}`, RESEND_USER_LIMIT);
    if (!rl.allowed) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many resend attempts. Please wait before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    const db = getDb();

    // Load user
    const userRows = await db
      .select({ id: users.id, email: users.email, phone: users.phone, name: users.name })
      .from(users)
      .where(eq(users.id, userId));

    if (userRows.length === 0) {
      // Return success silently — don't reveal whether a userId exists.
      return NextResponse.json({ success: true });
    }

    const user = userRows[0];

    // Invalidate old tokens of this type
    await db
      .update(verificationTokens)
      .set({ used: 1 })
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, type),
          eq(verificationTokens.used, 0)
        )
      );

    const now = Date.now();
    const code = generateOTP();
    const codeHash = await hashOTP(code);
    const expiresAt = now + 15 * 60 * 1000;
    const tokenId = `vt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    await db.insert(verificationTokens).values({
      id: tokenId,
      userId,
      type,
      code: codeHash,
      expiresAt,
      used: 0,
      createdAt: now,
    });

    if (type === "EMAIL") {
      try {
        await sendEmailOTP(user.email, user.name, code);
      } catch (sendErr) {
        log.warn("Email send failed for OTP resend", { userId, error: String(sendErr) });
        return NextResponse.json({ error: "Failed to send email. Please try again shortly." }, { status: 502 });
      }
    } else {
      // PHONE type: try SMS first, always send email as backup
      const smsSent = user.phone ? await sendSMSOTP(user.phone, code) : false;
      try {
        await sendPhoneVerificationEmail(user.email, user.name, code);
      } catch (sendErr) {
        if (!smsSent) {
          log.warn("Both SMS and email failed for phone OTP resend", { userId, error: String(sendErr) });
          return NextResponse.json({ error: "Failed to send verification code. Please try again shortly." }, { status: 502 });
        }
        log.warn("Email fallback failed for phone OTP resend (SMS succeeded)", { userId });
      }
    }

    log.info("OTP resent", { userId, type });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    log.error("Resend OTP error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
