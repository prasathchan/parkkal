import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verificationTokens, users } from "@/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`phone-otp:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many OTP requests. Please wait before trying again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json() as { userId?: string; phone?: string };
    const { userId, phone } = body;

    if (!userId || !phone) {
      return NextResponse.json({ error: "User ID and phone are required" }, { status: 400 });
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: "Invalid phone number — must be at least 10 digits" }, { status: 400 });
    }

    // Build E.164: 10 digits → +91, 12 digits starting 91 → +91xxx, else +xxx
    let e164: string;
    if (phoneDigits.length === 10) {
      e164 = `+91${phoneDigits}`;
    } else if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) {
      e164 = `+${phoneDigits}`;
    } else {
      e164 = `+${phoneDigits}`;
    }

    const db = getDb();
    const now = Date.now();

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.update(users).set({ phone: phoneDigits, updatedAt: now }).where(eq(users.id, userId));

    await db.delete(verificationTokens)
      .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.type, "PHONE_OTP")));

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 15 * 60 * 1000;
    const tokenId = `vt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    await db.insert(verificationTokens).values({
      id: tokenId,
      userId,
      type: "PHONE_OTP",
      code: otp,
      expiresAt,
      used: 0,
      createdAt: now,
    });

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !authToken || !from) {
      console.warn("[SMS] Twilio not configured — OTP:", otp);
      return NextResponse.json({ sent: true });
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const credentials = Buffer.from(`${sid}:${authToken}`).toString("base64");
    const smsBody = new URLSearchParams({
      From: from,
      To: e164,
      Body: `Your verification code: ${otp}. Valid for 15 minutes. Do not share this.`,
    });

    const smsRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: smsBody.toString(),
    });

    if (!smsRes.ok) {
      const err = await smsRes.text();
      console.error("[SMS] Twilio error:", err);
      return NextResponse.json({ error: "Failed to send SMS. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Request phone OTP error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
