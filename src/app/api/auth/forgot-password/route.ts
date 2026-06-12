import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users, verificationTokens } from "@/db/schema";
import { hashOTP } from "@/lib/otp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

const schema = z.object({ email: z.string().email() });

const RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 per hour per IP

function generateOTP(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

// Uniform response — always return 200 regardless of whether email exists.
// Must be a fresh Response per request: a Response body is single-use.
const ok = () =>
  NextResponse.json({ message: "If that email has an account, a reset code has been sent." });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`forgot:${ip}`, RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ok(); // don't leak whether email is valid

  const { email } = parsed.data;
  const db = getDb();

  const user = await db.select({ id: users.id, name: users.name, isVerified: users.isVerified })
    .from(users).where(eq(users.email, email.toLowerCase())).get();

  if (!user || !user.isVerified) return ok();

  const code = generateOTP();
  const hash = await hashOTP(code);
  const now  = Date.now();
  const TTL  = 15 * 60 * 1000; // 15 min

  // Invalidate any previous unused reset tokens for this user
  await db.update(verificationTokens).set({ used: 1 })
    .where(and(
      eq(verificationTokens.userId, user.id),
      eq(verificationTokens.type, "PASSWORD_RESET" as "EMAIL"), // cast — no CHECK constraint in DB
      eq(verificationTokens.used, 0),
    ));

  await db.insert(verificationTokens).values({
    id:        generateId(),
    userId:    user.id,
    type:      "PASSWORD_RESET" as "EMAIL",
    code:      hash,
    expiresAt: now + TTL,
    used:      0,
    createdAt: now,
  });

  try {
    await sendPasswordResetEmail(email, user.name, code);
  } catch (err) {
    logger.forRoute("POST /api/auth/forgot-password").error("Failed to send reset email", err);
  }

  return ok();
}
