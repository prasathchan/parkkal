import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, "OTP must be 6 digits"),
});

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/auth/phone/verify-otp", session);

  try {
    const body = await request.json();
    const { code } = verifySchema.parse(body);

    const db = getDb();
    const now = Date.now();

    // Find a valid, unused, unexpired PHONE_OTP token for this user with the given code
    const [token] = await db
      .select({ id: verificationTokens.id })
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, session.userId),
          eq(verificationTokens.type, "PHONE_OTP"),
          eq(verificationTokens.code, code),
          eq(verificationTokens.used, 0),
          gt(verificationTokens.expiresAt, now)
        )
      );

    if (!token) {
      log.security("Phone OTP verification failed: invalid or expired", { userId: session.userId });
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // Mark token as used
    await db
      .update(verificationTokens)
      .set({ used: 1 })
      .where(eq(verificationTokens.id, token.id));

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
