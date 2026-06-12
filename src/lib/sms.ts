/**
 * lib/sms.ts
 *
 * SMS delivery via MSG91 — used for OTP verification codes.
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *   Required environment variables:
 *     MSG91_API_KEY         — authkey from msg91.com dashboard
 *     MSG91_SENDER_ID       — 6-char DLT-registered sender ID (e.g. PARKDNT)
 *     MSG91_OTP_TEMPLATE_ID — Template ID from MSG91 for the OTP message
 *                             Template body example:
 *                             "##OTP## is your Parkkal verification code.
 *                              Valid for 15 minutes. Do not share. -PARKDNT"
 *
 *   Without these, SMS is silently skipped. In development the OTP is printed
 *   to the console instead so you can still test the flow without credentials.
 *
 * ─── DLT NOTE ────────────────────────────────────────────────────────────────
 *   TRAI mandates DLT registration for all commercial SMS in India.
 *   Register at: https://www.trai.gov.in/dlt
 *   Then register your sender ID and OTP template in the MSG91 dashboard.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   sendSMSOTP(to, code)   → sends a 6-digit OTP to the given phone number
 */

import env from "@/lib/env";

// Normalize to MSG91's expected format: country code + number, no + prefix.
// E.g. "9876543210" → "919876543210", "+919876543210" → "919876543210"
function toMsg91Mobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export async function sendSMSOTP(to: string, code: string): Promise<void> {
  const apiKey     = env.MSG91_API_KEY;
  const templateId = env.MSG91_OTP_TEMPLATE_ID;
  const senderId   = env.MSG91_SENDER_ID;

  if (!apiKey || !templateId || !senderId) {
    if (env.NODE_ENV !== "production") {
      console.warn("[SMS] MSG91 not configured — skipping SMS. OTP:", code);
    } else {
      console.warn("[SMS] MSG91 not configured — skipping SMS send.");
    }
    return;
  }

  const res = await fetch("https://api.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      authkey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      mobile:      toMsg91Mobile(to),
      otp:         code,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[SMS] MSG91 OTP send failed:", err);
    throw new Error(`SMS send failed: ${res.status}`);
  }

  const data = await res.json() as { type?: string; message?: string };
  if (data.type === "error") {
    console.error("[SMS] MSG91 error:", data.message);
    throw new Error(`SMS send error: ${data.message}`);
  }
}
