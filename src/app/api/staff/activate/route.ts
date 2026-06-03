import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit: 10 activation attempts per IP per 15 minutes.
  // While STAFF_INVITE tokens are UUID-length (hard to brute-force), defense in depth
  // prevents enumeration and abuse of the endpoint.
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`staff-activate:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many activation attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json() as { token?: unknown; password?: unknown };
    const token = typeof body.token === "string" ? body.token : null;
    const password = typeof body.password === "string" ? body.password : null;

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    const vtRecord = (await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.code, token),
          eq(verificationTokens.type, "STAFF_INVITE"),
          eq(verificationTokens.used, 0),
          gt(verificationTokens.expiresAt, now)
        )
      )
    )[0];

    if (!vtRecord) {
      return NextResponse.json({ error: "Invalid or expired activation link" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, vtRecord.userId));

    await db
      .update(verificationTokens)
      .set({ used: 1 })
      .where(eq(verificationTokens.id, vtRecord.id));

    return NextResponse.json({ userId: vtRecord.userId });
  } catch (error) {
    console.error("Staff activate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
