/**
 * lib/sms.ts
 *
 * SMS delivery via MSG91 OTP Widget API — used for OTP verification codes.
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *   Required environment variables:
 *     MSG91_API_KEY    — authkey from msg91.com dashboard
 *     MSG91_WIDGET_ID  — Widget ID from MSG91 OTP Widgets section
 *
 *   Without these, SMS is silently skipped (email OTP is always the fallback).
 *
 * ─── WIDGET FLOW ─────────────────────────────────────────────────────────────
 *   The Widget API has MSG91 manage the OTP entirely — no TRAI DLT registration
 *   required. MSG91 generates and delivers the code; we store only the reqId.
 *
 *   1. sendMSG91WidgetOTP(phone)             → MSG91 sends SMS, returns reqId
 *   2. Store reqId; user submits the code they received via SMS
 *   3. verifyMSG91WidgetOTP(phone, reqId, otp) → MSG91 confirms or rejects
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   sendMSG91WidgetOTP(phone)               → { sent, reqId? }  (never throws)
 *   verifyMSG91WidgetOTP(phone, reqId, otp) → boolean           (never throws)
 */

import env from "@/lib/env";

// Normalize to MSG91's expected format: country code + digits, no + prefix.
// E.g. "9876543210" → "919876543210", "+919876543210" → "919876543210"
function toMsg91Mobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export async function sendMSG91WidgetOTP(
  to: string
): Promise<{ sent: boolean; reqId?: string }> {
  const apiKey   = env.MSG91_API_KEY;
  const widgetId = env.MSG91_WIDGET_ID;

  if (!apiKey || !widgetId) {
    if (env.NODE_ENV !== "production") {
      console.warn("[SMS] MSG91 widget not configured — skipping SMS.");
    }
    return { sent: false };
  }

  if (env.MSG91_SANDBOX === "1") {
    console.warn("[SMS] MSG91 sandbox mode — OTP not delivered to phone.");
    return { sent: true, reqId: `sandbox_${Date.now()}` };
  }

  try {
    const res = await fetch(
      "https://control.msg91.com/api/v5/widget/create-process-otp",
      {
        method: "POST",
        headers: { authkey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ widgetId, identifier: toMsg91Mobile(to) }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[SMS] MSG91 widget send failed:", res.status, err.slice(0, 200));
      return { sent: false };
    }

    const data = await res.json() as { type?: string; message?: string; reqId?: string };
    if (data.type === "error") {
      console.error("[SMS] MSG91 widget error:", data.message);
      return { sent: false };
    }

    return { sent: true, reqId: data.reqId };
  } catch (err) {
    console.error("[SMS] MSG91 widget unexpected error:", err);
    return { sent: false };
  }
}

export async function verifyMSG91WidgetOTP(
  phone: string,
  reqId: string,
  otp: string
): Promise<boolean> {
  const apiKey   = env.MSG91_API_KEY;
  const widgetId = env.MSG91_WIDGET_ID;

  if (!apiKey || !widgetId) return false;

  // In sandbox mode MSG91 accepts any 6-digit code.
  if (env.MSG91_SANDBOX === "1") return /^\d{6}$/.test(otp);

  try {
    const res = await fetch(
      "https://control.msg91.com/api/v5/widget/verify-process-otp",
      {
        method: "POST",
        headers: { authkey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetId,
          identifier: toMsg91Mobile(phone),
          otp,
          reqId,
        }),
      }
    );

    if (!res.ok) return false;
    const data = await res.json() as { type?: string };
    return data.type === "success";
  } catch (err) {
    console.error("[SMS] MSG91 widget verify error:", err);
    return false;
  }
}
