import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens, users, organizationMembers } from "@/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: unknown; code?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : null;
    const code = typeof body.code === "string" ? body.code.trim() : null;

    if (!userId || !code) {
      return NextResponse.json({ error: "userId and code are required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    const vtRecord = (await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, "PHONE_OTP"),
          eq(verificationTokens.code, code),
          eq(verificationTokens.used, 0),
          gt(verificationTokens.expiresAt, now)
        )
      )
    )[0];

    if (!vtRecord) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    // Activate user
    await db
      .update(users)
      .set({ isActive: 1, isVerified: 1, updatedAt: now })
      .where(eq(users.id, userId));

    // Activate all org members for this user
    await db
      .update(organizationMembers)
      .set({ isActive: 1 })
      .where(eq(organizationMembers.userId, userId));

    // Mark token used
    await db
      .update(verificationTokens)
      .set({ used: 1 })
      .where(eq(verificationTokens.id, vtRecord.id));

    return NextResponse.json({ activated: true });
  } catch (error) {
    console.error("Verify phone error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
