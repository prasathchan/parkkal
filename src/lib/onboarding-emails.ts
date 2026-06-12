/**
 * lib/onboarding-emails.ts
 *
 * Onboarding email sequence for new clinic accounts.
 *
 * ─── SEQUENCE ─────────────────────────────────────────────────────────────────
 *   Step 0 — Welcome (sent immediately at signup verification)
 *   Step 1 — Day 1:  Add your first patient
 *   Step 2 — Day 3:  Schedule appointments
 *   Step 3 — Day 7:  Tips to get the most from Parkkal
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 *   scheduleOnboardingEmails(db, orgId, userId, adminEmail, adminName)
 *     → inserts 4 rows into onboarding_emails with future scheduledAt timestamps
 *     → called once at the end of POST /api/auth/verify
 *
 *   processOnboardingEmails(db)
 *     → called by the daily 2am UTC cron (GET /api/cron/reminders or a dedicated route)
 *     → finds pending rows whose scheduledAt <= now, sends them, marks as sent
 */

import { eq, lte, and } from "drizzle-orm";
import { onboardingEmails } from "@/db/schema";
import env from "@/lib/env";
import type { DbInstance } from "@/lib/db";
import { generateId } from "@/lib/utils";

const APP_URL = "https://app.parkkal.com";
const FROM = "Parkkal <hello@parkkal.com>";
const REPLY_TO = "support@parkkal.com";

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { step: 0, delayMs: 0 },
  { step: 1, delayMs: 1  * 24 * 60 * 60 * 1000 },
  { step: 2, delayMs: 3  * 24 * 60 * 60 * 1000 },
  { step: 3, delayMs: 7  * 24 * 60 * 60 * 1000 },
];

// ─── Schedule ─────────────────────────────────────────────────────────────────

export async function scheduleOnboardingEmails(
  db: DbInstance,
  organizationId: string,
  userId: string,
): Promise<void> {
  const now = Date.now();
  const rows = STEPS.map(({ step, delayMs }) => ({
    id:             generateId(),
    organizationId,
    userId,
    step,
    scheduledAt:    now + delayMs,
    sentAt:         null,
    status:         "pending" as const,
    createdAt:      now,
  }));
  await db.insert(onboardingEmails).values(rows);
}

// ─── Process (called from cron) ───────────────────────────────────────────────

export async function processOnboardingEmails(db: DbInstance): Promise<{ sent: number; failed: number }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, failed: 0 };

  const now = Date.now();
  const due = await db
    .select({
      id:    onboardingEmails.id,
      userId: onboardingEmails.userId,
      organizationId: onboardingEmails.organizationId,
      step:  onboardingEmails.step,
    })
    .from(onboardingEmails)
    .where(
      and(
        eq(onboardingEmails.status, "pending"),
        lte(onboardingEmails.scheduledAt, now),
      )
    )
    .limit(50);

  if (due.length === 0) return { sent: 0, failed: 0 };

  // Fetch user details for each row
  const { users, organizations } = await import("@/db/schema");

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    try {
      const [userRow] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, row.userId));
      const [orgRow]  = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, row.organizationId));
      if (!userRow?.email) continue;

      const { subject, html } = buildEmail(row.step, userRow.name ?? "there", orgRow?.name ?? "your clinic");

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [userRow.email], subject, html }),
      });

      if (res.ok) {
        await db.update(onboardingEmails).set({ status: "sent", sentAt: Date.now() }).where(eq(onboardingEmails.id, row.id));
        sent++;
      } else {
        await db.update(onboardingEmails).set({ status: "failed" }).where(eq(onboardingEmails.id, row.id));
        failed++;
      }
    } catch {
      await db.update(onboardingEmails).set({ status: "failed" }).where(eq(onboardingEmails.id, row.id));
      failed++;
    }
  }

  return { sent, failed };
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildEmail(step: number, name: string, clinicName: string): { subject: string; html: string } {
  const header = (title: string) => `
    <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Parkkal</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 13px;">${title}</p>
    </div>`;

  const footer = `
    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} Parkkal ·
        <a href="${APP_URL}/dashboard/settings" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    </div>`;

  const wrap = (headerHtml: string, body: string) => `
    <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4ff;margin:0;padding:40px 20px;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        ${headerHtml}
        <div style="padding:36px 32px;">${body}</div>
        ${footer}
      </div>
    </body></html>`;

  const btn = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;">${label}</a>`;

  const p = (text: string) => `<p style="color:#6b7280;font-size:14px;margin:0 0 16px;line-height:1.6;">${text}</p>`;

  switch (step) {
    case 0:
      return {
        subject: `Welcome to Parkkal — your clinic is ready, ${name}!`,
        html: wrap(
          header("One Platform. Every Clinic. Zero Compromises"),
          `<p style="color:#374151;font-size:16px;font-weight:600;margin:0 0 16px;">Hi ${name}, welcome aboard!</p>
           ${p(`<strong>${clinicName}</strong> is now live on Parkkal. Here&rsquo;s how to get started in the next few minutes:`)}
           <ol style="color:#6b7280;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
             <li>Add your first patient from the <strong>Patients</strong> tab</li>
             <li>Record a visit or schedule an appointment</li>
             <li>Invite your staff from <strong>Settings → Staff</strong></li>
           </ol>
           <div style="text-align:center;margin:0 0 20px;">${btn(APP_URL + "/dashboard", "Open your dashboard →")}</div>
           ${p("Questions? Just reply to this email — we&rsquo;re happy to help.")}`,
        ),
      };

    case 1:
      return {
        subject: "Day 1 tip: add your first patient in 60 seconds",
        html: wrap(
          header("Getting started — Day 1"),
          `<p style="color:#374151;font-size:16px;font-weight:600;margin:0 0 16px;">Hi ${name},</p>
           ${p("The fastest way to see Parkkal&rsquo;s value is to add a real patient. It takes about 60 seconds.")}
           <ul style="color:#6b7280;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
             <li>Go to <strong>Patients → New Patient</strong></li>
             <li>Fill in name, phone, and date of birth</li>
             <li>Hit Save — that&rsquo;s it</li>
           </ul>
           <div style="text-align:center;margin:0 0 20px;">${btn(APP_URL + "/dashboard/patients", "Add a patient →")}</div>
           ${p("From the patient profile you can record visits, add prescriptions, and generate invoices — all in one place.")}`,
        ),
      };

    case 2:
      return {
        subject: "Day 3 tip: schedule appointments and set up reminders",
        html: wrap(
          header("Getting started — Day 3"),
          `<p style="color:#374151;font-size:16px;font-weight:600;margin:0 0 16px;">Hi ${name},</p>
           ${p("Parkkal automatically sends email reminders to patients 24 hours, 2 hours, and 1 hour before each appointment — reducing no-shows without any extra work.")}
           <ul style="color:#6b7280;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
             <li>Go to <strong>Appointments → New Appointment</strong></li>
             <li>Pick the patient, doctor, date, and time</li>
             <li>Save — reminders are scheduled automatically</li>
           </ul>
           <div style="text-align:center;margin:0 0 20px;">${btn(APP_URL + "/dashboard/appointments", "Schedule an appointment →")}</div>`,
        ),
      };

    case 3:
    default:
      return {
        subject: "7 days in — a few things you might have missed",
        html: wrap(
          header("Getting the most from Parkkal"),
          `<p style="color:#374151;font-size:16px;font-weight:600;margin:0 0 16px;">Hi ${name},</p>
           ${p("You&rsquo;ve been with Parkkal for a week. Here are a few features clinics find most valuable:")}
           <ul style="color:#6b7280;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
             <li><strong>Treatment Plans</strong> — create multi-step plans with consent signatures</li>
             <li><strong>Reports</strong> — revenue trends, aging reports, and patient funnel analytics</li>
             <li><strong>Roles &amp; Permissions</strong> — limit what reception staff can see vs. doctors</li>
             <li><strong>Recall System</strong> — flag patients who are overdue for a check-up</li>
           </ul>
           <div style="text-align:center;margin:0 0 20px;">${btn(APP_URL + "/dashboard", "Explore your dashboard →")}</div>
           ${p("Need help with anything? Reply to this email — we read every response.")}`,
        ),
      };
  }
}
