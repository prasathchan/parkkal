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
 *   SMS       — Twilio SMS (same credentials as OTP)
 *   WHATSAPP  — Twilio WhatsApp Business API
 *               Requires: TWILIO_WHATSAPP_NUMBER env var (e.g. "whatsapp:+14155238886")
 *               The patient's number is automatically prefixed with "whatsapp:"
 *   EMAIL     — Resend transactional email
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *
 *   SMS / WhatsApp (same Twilio account):
 *     TWILIO_ACCOUNT_SID    → from console.twilio.com
 *     TWILIO_AUTH_TOKEN     → from console.twilio.com
 *     TWILIO_PHONE_NUMBER   → SMS sender number (e.g. "+15551234567")
 *     TWILIO_WHATSAPP_NUMBER → WhatsApp sender (e.g. "whatsapp:+14155238886")
 *                              Use the Twilio sandbox for testing, or apply for a
 *                              WhatsApp Business number for production.
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

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone;
}

// ─── Twilio helper (shared by SMS + WhatsApp) ─────────────────────────────────

async function sendViaTwilio(from: string, to: string, body: string): Promise<void> {
  const sid   = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    console.warn("[NOTIFY] Twilio not configured — skipping notification to", to);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = Buffer.from(`${sid}:${token}`).toString("base64");

  const params = new URLSearchParams({ From: from, To: to, Body: body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio error ${res.status}: ${errText.slice(0, 200)}`);
  }
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

async function sendSMS(to: string, message: string): Promise<void> {
  const from = env.TWILIO_PHONE_NUMBER;
  if (!from) {
    console.warn("[NOTIFY] TWILIO_PHONE_NUMBER not set — skipping SMS to", to);
    return;
  }
  await sendViaTwilio(from, toE164(to), message);
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

async function sendWhatsApp(to: string, message: string): Promise<void> {
  const from = env.TWILIO_WHATSAPP_NUMBER; // e.g. "whatsapp:+14155238886"
  if (!from) {
    console.warn("[NOTIFY] TWILIO_WHATSAPP_NUMBER not set — skipping WhatsApp to", to);
    return;
  }
  // Twilio requires "whatsapp:" prefix on the To number as well
  const whatsappTo = `whatsapp:${toE164(to)}`;
  await sendViaTwilio(from, whatsappTo, message);
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
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
      <div style="background: #f8fafc; border-radius: 12px; padding: 32px;">
        <h2 style="color: #0f172a; margin: 0 0 8px;">🦷 Appointment Reminder</h2>
        ${patientName ? `<p style="color: #64748b; margin: 0 0 24px;">Hi ${patientName},</p>` : ""}
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 16px 0;">
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155;">${message.replace(/\n/g, "<br>")}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">
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
