import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, verificationTokens } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { sendSMSOTP } from "@/lib/sms";
import { logger } from "@/lib/logger";

const OTP_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }; // 3 per hour per userId

function generateOTP(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  // Treat the 4 bytes as a big-endian uint32 and take mod 1_000_000 for 6 digits
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(num % 1_000_000).padStart(6, "0");
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/auth/phone/request-otp", session);

  const db = getDb();

  // Fetch the user's phone number from the DB (don't trust the JWT)
  const [user] = await db
    .select({ phone: users.phone, name: users.name })
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user?.phone) {
    return NextResponse.json(
      { error: "No phone number on file. Update your profile first." },
      { status: 400 }
    );
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

  try {
    await sendSMSOTP(user.phone, code);
  } catch (err) {
    log.warn("SMS send failed for phone OTP", { error: String(err) });
    // Token is stored; caller can retry. Don't expose SMS provider errors.
  }

  // Return a masked phone for display only
  const masked =
    user.phone.length > 4
      ? "*".repeat(user.phone.length - 4) + user.phone.slice(-4)
      : user.phone;

  log.info("Phone OTP requested", { userId: session.userId });
  return NextResponse.json({ sent: true, maskedPhone: masked });
}
