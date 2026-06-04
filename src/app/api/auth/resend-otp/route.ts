import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users, verificationTokens } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmailOTP } from "@/lib/email";
import { sendSMSOTP } from "@/lib/sms";

const resendSchema = z.object({
  userId: z.string(),
  type: z.enum(["EMAIL", "PHONE"]),
});

const RESEND_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }; // 3 per hour per userId

function generateOTP(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type } = resendSchema.parse(body);

    // Rate limit by userId
    const rl = await checkRateLimit(`resend-otp:${userId}:${type}`, RESEND_RATE_LIMIT);
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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    const expiresAt = now + 15 * 60 * 1000;
    const tokenId = `vt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    await db.insert(verificationTokens).values({
      id: tokenId,
      userId,
      type,
      code,
      expiresAt,
      used: 0,
      createdAt: now,
    });

    if (type === "EMAIL") {
      await sendEmailOTP(user.email, user.name, code);
    } else {
      if (!user.phone) {
        return NextResponse.json({ error: "No phone number on file" }, { status: 400 });
      }
      await sendSMSOTP(user.phone, code);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Resend OTP error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
