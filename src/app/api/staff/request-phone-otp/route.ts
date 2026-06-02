import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens, users } from "@/db/schema";

async function sendSMSOTP(to: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.warn("[SMS] Twilio not configured — skipping SMS. OTP:", code);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = Buffer.from(`${sid}:${token}`).toString("base64");

  const body = new URLSearchParams({
    From: from,
    To: to,
    Body: `Your Parkkal activation code: ${code}. Valid for 15 minutes. Do not share this with anyone.`,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[SMS] Failed to send OTP SMS:", err);
    throw new Error(`SMS send failed: ${res.status}`);
  }
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: unknown; phone?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : null;
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;

    if (!userId || !phone) {
      return NextResponse.json({ error: "userId and phone are required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    // Update user phone
    await db
      .update(users)
      .set({ phone, updatedAt: now })
      .where(eq(users.id, userId));

    // Delete existing PHONE_OTP tokens for this user
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, "PHONE_OTP")
        )
      );

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes

    await db.insert(verificationTokens).values({
      id: `vt_${randomHex(12)}`,
      userId,
      type: "PHONE_OTP",
      code: otp,
      expiresAt,
      used: 0,
      createdAt: now,
    });

    // Send SMS
    await sendSMSOTP(phone, otp);

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Request phone OTP error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
