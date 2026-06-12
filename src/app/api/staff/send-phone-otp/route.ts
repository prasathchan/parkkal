/**
 * POST /api/staff/send-phone-otp
 *
 * Admin-only: send a phone OTP (SMS + email) to any staff member.
 * Used from the staff detail page to test SMS delivery or manually
 * re-send a verification code without requiring the user to be in
 * the activation flow.
 *
 * Unlike /api/staff/request-phone-otp, this route:
 *   - Requires STAFF_MANAGE permission (admin session, same org)
 *   - Does NOT check isActive/isVerified — works for all staff states
 *   - Returns { sent, smsSent } so the UI can show which channels fired
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { users, verificationTokens, organizationMembers } from "@/db/schema";
import { hashOTP } from "@/lib/otp";
import { sendSMSOTP } from "@/lib/sms";
import { sendPhoneVerificationEmail } from "@/lib/email";

const bodySchema = z.object({
  userId: z.string().min(1),
});

export const POST = withRoute(
  { route: "POST /api/staff/send-phone-otp", rateLimit: RATE_LIMITS.OTP, permission: PERMISSIONS.STAFF_MANAGE },
  async (req, { session, db }) => {
    const body = bodySchema.parse(await req.json());
    const { userId } = body;

    // Ensure the target user belongs to the same organisation
    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, session.orgId),
        )
      );

    if (!membership) return apiError("Staff member not found", 404);

    const [user] = await db
      .select({ phone: users.phone, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) return apiError("User not found", 404);
    if (!user.phone) return apiError("This staff member has no phone number on file", 400);
    if (!user.email) return apiError("This staff member has no email address on file", 400);

    const now = Date.now();
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const otp = String(100000 + (buf[0] % 900000));
    const otpHash = await hashOTP(otp);
    const tokenId = `vt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    await db.insert(verificationTokens).values({
      id: tokenId,
      userId,
      type: "PHONE_OTP",
      code: otpHash,
      expiresAt: now + 15 * 60 * 1000,
      used: 0,
      createdAt: now,
    });

    const smsSent = await sendSMSOTP(user.phone, otp);

    let emailSent = false;
    try {
      await sendPhoneVerificationEmail(user.email, user.name ?? "there", otp);
      emailSent = true;
    } catch {
      if (!smsSent) {
        return apiError("Both SMS and email failed — please check MSG91 and Resend configuration", 500);
      }
    }

    return apiOk({ sent: true, smsSent, emailSent });
  },
);
