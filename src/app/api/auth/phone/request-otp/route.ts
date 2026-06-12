import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, verificationTokens } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { sendPhoneVerificationEmail } from "@/lib/email";
import { sendSMSOTP } from "@/lib/sms";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const OTP_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }; // 3 per hour per userId (DB-level)
const IP_RATE_LIMIT = { limit: 10, windowMs: 60_000 }; // 10 per minute per IP (fast pre-check)

function generateOTP(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  // Treat the 4 bytes as a big-endian uint32 and take mod 1_000_000 for 6 digits
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
  const code = generateOTP();
  const tokenId = `vt_${Array.from(
    crypto.getRandomValues(new Uint8Array(12)),
    (b: number) => b.toString(16).padStart(2, "0")
  ).join("")}`;

  await db.insert(verificationTokens).values({
    id: tokenId,
    userId: session.userId,
    type: "PHONE_OTP",
    code,
    expiresAt: now + 15 * 60 * 1000, // 15 minutes
    used: 0,
    createdAt: now,
  });

  // Try SMS first; always follow with email as fallback — if SMS fails silently,
  // the user still gets the code via email.
  const smsSent = await sendSMSOTP(user.phone, code);
  if (!smsSent) {
    log.warn("SMS OTP failed, falling back to email", { userId: session.userId });
  }

  try {
    await sendPhoneVerificationEmail(user.email, user.name, code);
  } catch (err) {
    if (!smsSent) {
      // Both channels failed — the user has no way to receive the code.
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

  log.info("Phone OTP sent", { userId: session.userId, smsSent });
  return NextResponse.json({ sent: true, maskedEmail, maskedPhone, smsSent });
}
