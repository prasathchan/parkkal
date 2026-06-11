/**
 * lib/email.ts
 *
 * Transactional email delivery via Resend (resend.com).
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *   Set RESEND_API_KEY in your environment (Cloudflare secret or .env.local).
 *   Without it, emails are silently skipped with a console warning. In
 *   development the activation URL or OTP code is logged to the console.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   sendStaffInviteEmail(to, name, orgName, activationUrl)
 *     → Sends a branded welcome email to a newly invited staff member.
 *       Includes a button linking to their account activation page.
 *
 *   sendEmailOTP(to, name, code)
 *     → Sends a 6-digit OTP code for email-based login/verification.
 *        Code expires in 15 minutes (enforced by the calling route, not here).
 */

import env from "@/lib/env";

export async function sendStaffInviteEmail(
  to: string,
  name: string,
  orgName: string,
  activationUrl: string
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[EMAIL] RESEND_API_KEY not set — skipping invite email. URL:", activationUrl);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>You've been added to ${orgName}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4ff; margin: 0; padding: 40px 20px;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Parkkal</h1>
          <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">One Platform. Every Clinic. Zero Compromises</p>
        </div>
        <div style="padding: 40px 32px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">Hi ${name},</p>
          <p style="color: #6b7280; font-size: 15px; margin: 0 0 24px;">
            You've been added as a staff member at <strong style="color: #1e40af;">${orgName}</strong> on Parkkal.
            Click the button below to set up your account and get started.
          </p>
          <div style="text-align: center; margin: 0 0 32px;">
            <a href="${activationUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px;">
              Set up your account
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px;">
            This link expires in <strong>7 days</strong>. If you did not expect this invitation, you can safely ignore this email.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 0; word-break: break-all;">
            Or copy this link: <a href="${activationUrl}" style="color: #3b82f6;">${activationUrl}</a>
          </p>
        </div>
        <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Parkkal</p>
        </div>
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
      from: "Parkkal <noreply@parkkal.com>",
      to: [to],
      subject: `You've been added to ${orgName} — Set up your account`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[EMAIL] Failed to send staff invite email:", err);
    throw new Error(`Email send failed: ${res.status}`);
  }
}

export async function sendEmailOTP(to: string, name: string, code: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[EMAIL] RESEND_API_KEY not set — skipping email send. OTP:", code);
    } else {
      console.warn("[EMAIL] RESEND_API_KEY not set — skipping email send.");
    }
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Your Parkkal Verification Code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4ff; margin: 0; padding: 40px 20px;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Parkkal</h1>
          <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">One Platform. Every Clinic. Zero Compromises</p>
        </div>
        <div style="padding: 40px 32px; text-align: center;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">Hi ${name},</p>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 32px;">Use the verification code below to complete your registration. This code expires in <strong>15 minutes</strong>.</p>
          <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; margin: 0 0 32px;">
            <p style="color: #1e40af; font-size: 40px; font-weight: 800; letter-spacing: 12px; margin: 0; font-family: monospace;">${code}</p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Parkkal</p>
        </div>
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
      from: "Parkkal <noreply@parkkal.com>",
      to: [to],
      subject: "Your Parkkal verification code",
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[EMAIL] Failed to send OTP email:", err);
    throw new Error(`Email send failed: ${res.status}`);
  }
}
