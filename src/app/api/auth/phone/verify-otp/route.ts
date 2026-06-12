import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, verificationTokens } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { verifyOTP } from "@/lib/otp";
import { verifyMSG91WidgetOTP } from "@/lib/sms";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const OTP_VERIFY_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, "OTP must be 6 digits"),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(`otp-verify:${ip}`, OTP_VERIFY_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/auth/phone/verify-otp", session);

  try {
    const body = await request.json();
    const { code } = verifySchema.parse(body);

    const db = getDb();
    const now = Date.now();

    // Fetch user's phone (needed for MSG91 widget verify call)
    const [user] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, session.userId));

    // Fetch ALL valid PHONE_OTP tokens — there may be one for SMS (msg91:) and
    // one for email (bcrypt hash). Accept whichever the user submits.
    const tokens = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, session.userId),
          eq(verificationTokens.type, "PHONE_OTP"),
          eq(verificationTokens.used, 0),
          gt(verificationTokens.expiresAt, now)
        )
      );

    if (tokens.length === 0) {
      log.security("Phone OTP verification failed: no valid token found", { userId: session.userId });
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    let matched = false;
    for (const token of tokens) {
      if (token.code.startsWith("msg91:") && user?.phone) {
        // SMS path: verify against MSG91 Widget API
        const reqId = token.code.slice(6);
        matched = await verifyMSG91WidgetOTP(user.phone, reqId, code);
      } else {
        // Email path: verify against local bcrypt hash
        matched = await verifyOTP(code, token.code);
      }
      if (matched) break;
    }

    if (!matched) {
      log.security("Phone OTP verification failed: invalid or expired", { userId: session.userId });
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // Mark all tokens for this user+type as used
    await db
      .update(verificationTokens)
      .set({ used: 1 })
      .where(
        and(
          eq(verificationTokens.userId, session.userId),
          eq(verificationTokens.type, "PHONE_OTP"),
          eq(verificationTokens.used, 0)
        )
      );

    log.info("Phone OTP verified", { userId: session.userId });
    return NextResponse.json({ verified: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    log.error("Phone OTP verification error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
