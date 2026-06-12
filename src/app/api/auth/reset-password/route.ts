import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users, verificationTokens } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { verifyOTP } from "@/lib/otp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  email:    z.string().email(),
  code:     z.string().length(6),
  password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must contain at least one letter and one number"),
});

const RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 }; // 10 per 15 min per IP

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`reset:${ip}`, RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const { email, code, password } = parsed.data;
  const db  = getDb();
  const now = Date.now();

  const user = await db.select({ id: users.id })
    .from(users).where(eq(users.email, email.toLowerCase())).get();

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset code." }, { status: 400 });
  }

  const token = await db.select()
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.userId, user.id),
      eq(verificationTokens.type, "PASSWORD_RESET" as "EMAIL"),
      eq(verificationTokens.used, 0),
      gt(verificationTokens.expiresAt, now),
    ))
    .get();

  if (!token) {
    return NextResponse.json({ error: "Invalid or expired reset code." }, { status: 400 });
  }

  const valid = await verifyOTP(code, token.code);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired reset code." }, { status: 400 });
  }

  const hashed = await hashPassword(password);

  await Promise.all([
    db.update(users).set({ passwordHash: hashed, updatedAt: now }).where(eq(users.id, user.id)),
    db.update(verificationTokens).set({ used: 1 }).where(eq(verificationTokens.id, token.id)),
  ]);

  return NextResponse.json({ message: "Password reset successfully. You can now sign in." });
}
