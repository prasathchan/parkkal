import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens, users, organizationMembers } from "@/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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

  try {
    const body = await request.json() as { userId?: string; code?: string };
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: "User ID and code are required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

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

    await db.update(organizationMembers)
      .set({ isActive: 1 })
      .where(eq(organizationMembers.userId, userId));

    await db.update(verificationTokens)
      .set({ used: 1 })
      .where(eq(verificationTokens.id, tokenRecord.id));

    return NextResponse.json({ activated: true });
  } catch (error) {
    console.error("Verify phone error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
