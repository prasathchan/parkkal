import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, verificationTokens } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { sendPhoneVerificationEmail } from "@/lib/email";
import { sendMSG91WidgetOTP } from "@/lib/sms";
import { hashOTP } from "@/lib/otp";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const OTP_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }; // 3 per hour per userId (DB-level)
const IP_RATE_LIMIT  = { limit: 10, windowMs: 60_000 };         // 10 per minute per IP (fast pre-check)

function generateOTP(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(num % 1_000_000).padStart(6, "0");
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const ipRl = await checkRateLimit(`otp-req:${ip}`, IP_RATE_LIMIT);
  if (!ipRl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/auth/phone/request-otp", session);

  const db = getDb();

  const [user] = await db
    .select({ phone: users.phone, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user?.phone) {
    return NextResponse.json(
      { error: "No phone number on file. Update your profile first." },
      { status: 400 }
    );
  }

  if (!user.email) {
    return NextResponse.json({ error: "No email address on file." }, { status: 400 });
  }

  // Rate-limit: max 3 OTPs per hour per userId
  const windowStart = Date.now() - OTP_RATE_LIMIT.windowMs;
  const [{ recentCount }] = await db
    .select({ recentCount: count() })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.userId, session.userId),
        eq(verificationTokens.type, "PHONE_OTP"),
        gte(verificationTokens.createdAt, windowStart)
      )
    );

  if ((recentCount as number) >= OTP_RATE_LIMIT.limit) {
    return NextResponse.json(
      { error: "Too many OTP requests. Please wait before requesting another." },
      { status: 429 }
    );
  }

  const now = Date.now();
  const tokenBase = () =>
    `vt_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b: number) =>
      b.toString(16).padStart(2, "0")
    ).join("")}`;

  // ── SMS path: MSG91 Widget generates and delivers the OTP ─────────────────
  const { sent: smsSent, reqId } = await sendMSG91WidgetOTP(user.phone);

  if (smsSent && reqId) {
    // Store reqId so we can verify against MSG91 API later
    await db.insert(verificationTokens).values({
      id: tokenBase(),
      userId:    session.userId,
      type:      "PHONE_OTP",
      code:      `msg91:${reqId}`,
      expiresAt: now + 15 * 60 * 1000,
      used:      0,
      createdAt: now,
    });
  } else {
    log.warn("MSG91 widget SMS failed, will rely on email OTP", { userId: session.userId });
  }

  // ── Email path: always send our own OTP as a fallback ─────────────────────
  const emailCode = generateOTP();
  const emailHash = await hashOTP(emailCode);

  await db.insert(verificationTokens).values({
    id:        tokenBase(),
    userId:    session.userId,
    type:      "PHONE_OTP",
    code:      emailHash,
    expiresAt: now + 15 * 60 * 1000,
    used:      0,
    createdAt: now,
  });

  let emailSent = false;
  try {
    await sendPhoneVerificationEmail(user.email, user.name, emailCode);
    emailSent = true;
  } catch (err) {
    if (!smsSent) {
      log.error("Both SMS and email failed for phone OTP", { error: String(err), userId: session.userId });
      return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
    }
    log.warn("Email fallback failed for phone OTP (SMS succeeded)", { error: String(err) });
  }

  const maskedEmail = (() => {
    const [local, domain] = user.email.split("@");
    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
  })();

  const maskedPhone = user.phone.slice(-4).padStart(user.phone.length, "*");

  log.info("Phone OTP sent", { userId: session.userId, smsSent, emailSent });
  return NextResponse.json({ sent: true, maskedEmail, maskedPhone, smsSent });
}
