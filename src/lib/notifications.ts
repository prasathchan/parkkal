/**
 * lib/notifications.ts
 *
 * Unified notification sender for appointment reminders.
 * Supports SMS, WhatsApp, and Email channels.
 *
 * ─── HOW TO USE ──────────────────────────────────────────────────────────────
 *
 *   import { sendNotification } from "@/lib/notifications";
 *
 *   await sendNotification({
 *     channel: "SMS",
 *     to: "+919876543210",
 *     message: "Hi Raj, reminder: appointment tomorrow at 10:00 AM at City Dental.",
 *   });
 *
 * ─── CHANNELS ────────────────────────────────────────────────────────────────
 *
 *   SMS       — MSG91 transactional SMS (DLT-registered flow)
 *               Requires: MSG91_API_KEY, MSG91_SENDER_ID, MSG91_SMS_FLOW_ID
 *               The flow template must have a single variable ##VAR1## which
 *               receives the full reminder message text.
 *               Register template at: https://control.msg91.com
 *
 *   WHATSAPP  — Not yet active. Requires MSG91 WhatsApp Business API approval.
 *               Falls back to SMS silently when not configured.
 *
 *   EMAIL     — Resend transactional email
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *
 *   SMS:
 *     MSG91_API_KEY         → authkey from msg91.com dashboard
 *     MSG91_SENDER_ID       → 6-char DLT sender ID (e.g. PARKDNT)
 *     MSG91_SMS_FLOW_ID     → Flow ID for appointment reminder template
 *
 *   Email:
 *     RESEND_API_KEY        → from resend.com (already required for OTP emails)
 *     RESEND_FROM_EMAIL     → sender address (e.g. "reminders@yourclinicdomain.com")
 *                              Must be verified in your Resend dashboard.
 *
 * ─── SILENCE ON MISSING CONFIG ───────────────────────────────────────────────
 *
 *   If credentials are missing, the function logs a warning and returns without
 *   throwing. This prevents a missing env var from crashing the cron job and
 *   blocking ALL reminders. The caller records FAILED status in the DB.
 *
 * ─── MESSAGE TEMPLATES ───────────────────────────────────────────────────────
 *   Use buildReminderMessage() to generate the standard reminder text.
 */

import env from "@/lib/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = "SMS" | "WHATSAPP" | "EMAIL";

export interface SendNotificationParams {
  channel:    NotificationChannel;
  to:         string;   // phone number (E.164) or email address
  message:    string;   // pre-rendered message text
  subject?:   string;   // email subject (optional for SMS/WhatsApp)
  patientName?: string; // used to personalise email HTML
}

// ─── Phone normalizer ─────────────────────────────────────────────────────────

// MSG91 expects country code + number without the + prefix: "919876543210"
function toMsg91Mobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

// ─── SMS via MSG91 Flow API ───────────────────────────────────────────────────

async function sendSMS(to: string, message: string): Promise<void> {
  const apiKey   = env.MSG91_API_KEY;
  const senderId = env.MSG91_SENDER_ID;
  const flowId   = env.MSG91_SMS_FLOW_ID;

  if (!apiKey || !senderId || !flowId) {
    console.warn("[NOTIFY] MSG91 not configured — skipping SMS to", to);
    return;
  }

  const res = await fetch("https://api.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      flow_id: flowId,
      sender:  senderId,
      mobiles: toMsg91Mobile(to),
      VAR1:    message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MSG91 SMS error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as { type?: string; message?: string };
  if (data.type === "error") {
    throw new Error(`MSG91 SMS error: ${data.message}`);
  }
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
// WhatsApp via MSG91 requires separate WhatsApp Business API approval and
// a different integration. Until that is set up, fall back to SMS silently.

async function sendWhatsApp(to: string, message: string): Promise<void> {
  console.warn("[NOTIFY] WhatsApp not yet configured — falling back to SMS for", to);
  await sendSMS(to, message);
}

// ─── Email ────────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, message: string, patientName?: string): Promise<void> {
  const apiKey  = env.RESEND_API_KEY;
  const fromEmail = env.RESEND_FROM_EMAIL ?? "reminders@parkkal.com";

  if (!apiKey) {
    console.warn("[NOTIFY] RESEND_API_KEY not set — skipping email to", to);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1C1A15;">
      <div style="background: #FAF8F3; border-radius: 12px; padding: 32px;">
        <h2 style="color: #1C1A15; margin: 0 0 8px;">🦷 Appointment Reminder</h2>
        ${patientName ? `<p style="color: #645D50; margin: 0 0 24px;">Hi ${patientName},</p>` : ""}
        <div style="background: white; border: 1px solid #E5E0D8; border-radius: 8px; padding: 20px; margin: 16px 0;">
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4A4439;">${message.replace(/\n/g, "<br>")}</p>
        </div>
        <p style="color: #B0A99B; font-size: 12px; margin: 16px 0 0;">
          This is an automated reminder from Parkkal.
          Please contact the clinic directly to reschedule or cancel.
        </p>
      </div>
    </body>
    </html>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to:   [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err.slice(0, 200)}`);
  }
}

// ─── Unified sender ───────────────────────────────────────────────────────────

/**
 * Send a notification via the specified channel.
 * Throws on delivery failure so the caller can mark the reminder as FAILED.
 */
export async function sendNotification(params: SendNotificationParams): Promise<void> {
  const { channel, to, message, subject, patientName } = params;

  switch (channel) {
    case "SMS":
      await sendSMS(to, message);
      break;

    case "WHATSAPP":
      await sendWhatsApp(to, message);
      break;

    case "EMAIL":
      await sendEmail(
        to,
        subject ?? "Appointment Reminder — Parkkal",
        message,
        patientName,
      );
      break;

    default:
      throw new Error(`Unknown notification channel: ${channel}`);
  }
}

// ─── Message templates ────────────────────────────────────────────────────────

export interface ReminderMessageParams {
  patientName:  string;
  clinicName:   string;
  appointmentDate: string;   // "YYYY-MM-DD"
  appointmentTime: string;   // "HH:MM"
  doctorName?:  string;
  reminderType: "24H" | "2H" | "1H";
  channel:      NotificationChannel;
}

/**
 * Build the reminder message for a given channel and timing.
 * Pre-rendered at schedule time so patient/clinic renames don't affect sent messages.
 */
export function buildReminderMessage(p: ReminderMessageParams): string {
  // Format date: "2025-06-09" → "Monday, 9 Jun 2025"
  const dateObj = new Date(`${p.appointmentDate}T${p.appointmentTime}:00`);
  const formattedDate = dateObj.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
  const formattedTime = dateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const timing =
    p.reminderType === "24H" ? "tomorrow" :
    p.reminderType === "2H"  ? "in 2 hours" :
    "in 1 hour";

  const doctorLine = p.doctorName ? `\nDoctor: ${p.doctorName}` : "";

  if (p.channel === "WHATSAPP") {
    // WhatsApp supports minimal markdown
    return (
      `🦷 *Appointment Reminder*\n\n` +
      `Hi ${p.patientName}, you have an appointment *${timing}*:\n\n` +
      `📅 *${formattedDate}*\n` +
      `⏰ *${formattedTime}*\n` +
      `🏥 ${p.clinicName}${doctorLine}\n\n` +
      `Please arrive 5 minutes early. To reschedule, call the clinic directly.\n\n` +
      `_Powered by Parkkal_`
    );
  }

  // SMS and Email (plain text)
  return (
    `Hi ${p.patientName}, reminder: you have a dental appointment ${timing} ` +
    `on ${formattedDate} at ${formattedTime} at ${p.clinicName}.` +
    (p.doctorName ? ` Doctor: ${p.doctorName}.` : "") +
    ` Please arrive 5 min early. To reschedule, call the clinic. -Parkkal`
  );
}
