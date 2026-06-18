/**
 * lib/sms.ts
 *
 * OTP delivery via MSG91 — SMS and WhatsApp channels.
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *   SMS OTP:
 *     MSG91_API_KEY    — authkey from msg91.com dashboard
 *     MSG91_WIDGET_ID  — OTP Widget ID (bypasses TRAI DLT carrier restriction)
 *
 *   WhatsApp OTP:
 *     MSG91_API_KEY          — same authkey as SMS
 *     MSG91_WHATSAPP_NUMBER  — approved WA Business number (e.g. "918056415796")
 *
 *   Without SMS vars, SMS is silently skipped (email OTP is always the fallback).
 *   Without WhatsApp vars, sendWhatsAppOTP() silently falls back to sendSMSOTP().
 *
 * ─── WHY WIDGET_ID NOT TEMPLATE_ID ───────────────────────────────────────────
 *   MSG91's standard OTP API accepts either template_id (requires TRAI DLT
 *   carrier registration) or widget_id (MSG91-managed, no DLT required).
 *   Using widget_id is the correct approach for India without DLT registration.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   sendSMSOTP(to, code)       → boolean (never throws)
 *   sendWhatsAppOTP(to, code)  → boolean (never throws; falls back to SMS)
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

export async function sendSMSOTP(to: string, code: string): Promise<boolean> {
  const apiKey   = env.MSG91_API_KEY;
  const widgetId = env.MSG91_WIDGET_ID;

  if (!apiKey || !widgetId) {
    if (env.NODE_ENV !== "production") {
      console.warn("[SMS] MSG91 not configured — skipping SMS. OTP:", code);
    }
    return false;
  }

  if (env.MSG91_SANDBOX === "1") {
    console.warn("[SMS] MSG91 sandbox mode — OTP not delivered to phone:", code);
    return true; // pretend success so the caller records a sent attempt
  }

  try {
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { authkey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        widget_id: widgetId,
        mobile:    toMsg91Mobile(to),
        otp:       code,
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

// ─── WhatsApp OTP via MSG91 Business API ──────────────────────────────────────
// Sends OTP as a WhatsApp text message. Falls back to SMS when WhatsApp vars
// are not configured. Never throws — returns false on any failure.

export async function sendWhatsAppOTP(to: string, code: string): Promise<boolean> {
  const apiKey         = env.MSG91_API_KEY;
  const waNumber       = env.MSG91_WHATSAPP_NUMBER;

  if (!apiKey || !waNumber) {
    // WhatsApp not configured — fall back to SMS silently
    return sendSMSOTP(to, code);
  }

  if (env.MSG91_SANDBOX === "1") {
    console.warn("[WA-OTP] Sandbox mode — OTP not delivered to phone:", code);
    return true;
  }

  const message =
    `🔐 *Parkkal Verification Code*\n\n` +
    `Your OTP is: *${code}*\n\n` +
    `Valid for 15 minutes. Do not share this code with anyone.\n\n` +
    `_Parkkal Dental_`;

  try {
    const res = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: { authkey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            from: waNumber,
            to:   toMsg91Mobile(to),
            message: { type: "text", text: { body: message } },
          },
        ]),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[WA-OTP] MSG91 error:", res.status, err.slice(0, 200));
      return sendSMSOTP(to, code); // fall back to SMS
    }

    const data = await res.json() as { type?: string; message?: string };
    if (data.type === "error") {
      console.error("[WA-OTP] MSG91 error:", data.message);
      return sendSMSOTP(to, code); // fall back to SMS
    }

    return true;
  } catch (err) {
    console.error("[WA-OTP] Unexpected error:", err);
    return sendSMSOTP(to, code); // fall back to SMS
  }
}
