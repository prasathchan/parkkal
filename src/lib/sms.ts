/**
 * lib/sms.ts
 *
 * SMS delivery via Twilio — currently used for OTP verification codes.
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *   Required environment variables:
 *     TWILIO_ACCOUNT_SID    — from console.twilio.com
 *     TWILIO_AUTH_TOKEN     — from console.twilio.com
 *     TWILIO_PHONE_NUMBER   — the Twilio number to send from (e.g. "+15551234567")
 *
 *   Without these, SMS is silently skipped. In development the OTP is printed
 *   to the console instead so you can still test the flow without a real number.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   sendSMSOTP(to, code)   → sends a 6-digit OTP to the given phone number
 */

// Normalize bare 10-digit Indian mobile numbers to E.164 (+91XXXXXXXXXX).
// Twilio rejects numbers without a country code prefix.
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone; // already has a prefix or unknown format — pass through
}

export async function sendSMSOTP(to: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[SMS] Twilio not configured — skipping SMS. OTP:", code);
    } else {
      console.warn("[SMS] Twilio not configured — skipping SMS send.");
    }
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = Buffer.from(`${sid}:${token}`).toString("base64");

  const body = new URLSearchParams({
    From: from,
    To: toE164(to),
    Body: `Your Parkkal verification code: ${code}. Valid for 15 minutes. Do not share this with anyone.`,
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
