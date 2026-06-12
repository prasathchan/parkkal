/**
 * lib/sms.ts
 *
 * SMS delivery via MSG91 OTP API — used for OTP verification codes.
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *   Required environment variables:
 *     MSG91_API_KEY         — authkey from msg91.com dashboard
 *     MSG91_SENDER_ID       — Sender ID (e.g. smsind or PARKDNT)
 *     MSG91_OTP_TEMPLATE_ID — Template ID approved by MSG91 (not TRAI DLT)
 *                             Current approved template: 6a2bf4ec79805f4a7d07f1c4
 *                             Body: "This is your OTP to Access: ##OTP##"
 *
 *   Without these, SMS is silently skipped (email OTP is always the fallback).
 *   In development the OTP is printed to the console.
 *
 * ─── NOTE ─────────────────────────────────────────────────────────────────────
 *   MSG91's OTP API (/api/v5/otp) uses MSG91-approved templates which do NOT
 *   require TRAI DLT registration — the OTP route has a special transactional
 *   exemption. The Flow API (/api/v5/flow/) is used for appointment reminders
 *   and DOES require DLT registration.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   sendSMSOTP(to, code)   → sends a 6-digit OTP to the given phone number
 *                            Returns true on success, false on failure (never throws)
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

export async function sendSMSOTP(to: string, code: string): Promise<boolean> {
  const apiKey     = env.MSG91_API_KEY;
  const templateId = env.MSG91_OTP_TEMPLATE_ID;
  const senderId   = env.MSG91_SENDER_ID;

  if (!apiKey || !templateId || !senderId) {
    if (env.NODE_ENV !== "production") {
      console.warn("[SMS] MSG91 not configured — skipping SMS. OTP:", code);
    } else {
      console.warn("[SMS] MSG91 not configured — skipping SMS send.");
    }
    return false;
  }

  const sandbox = env.MSG91_SANDBOX === "1";
  if (sandbox) {
    console.warn("[SMS] MSG91 sandbox mode — OTP will not be delivered to phone:", code);
  }

  try {
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
        sender:      senderId,
        ...(sandbox ? { sandbox: "1" } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[SMS] MSG91 OTP send failed:", res.status, err.slice(0, 200));
      return false;
    }

    const data = await res.json() as { type?: string; message?: string };
    if (data.type === "error") {
      console.error("[SMS] MSG91 error:", data.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[SMS] MSG91 unexpected error:", err);
    return false;
  }
}
