import { eq, and } from "drizzle-orm";
import { organizationMembers, users, organizations, verificationTokens } from "@/db/schema";
import { sendStaffInviteEmail } from "@/lib/email";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  mode: z.enum(["invite_link", "no_login_verify"]).default("invite_link"),
});

/** POST /api/org/members/[userId]/send-activation — resend activation email (ADMIN only) */
export const POST = withRoute<{ userId: string }>(
  { route: "POST /api/org/members/[userId]/send-activation", rateLimit: RATE_LIMITS.ADMIN, adminOnly: true },
  async (req, { session, db, log }, { userId }) => {
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const body = await req.json().catch(() => ({}));
    const { mode } = schema.parse(body);

    // Confirm target user belongs to this org
    const [member] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!member) return apiError("Member not found", 404);

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users).where(eq(users.id, userId));
    if (!user) return apiError("User not found", 404);

    // Invalidate previous unused STAFF_INVITE tokens
    await db.delete(verificationTokens)
      .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.type, "STAFF_INVITE"), eq(verificationTokens.used, 0)));

    const now = Date.now();
    const tokenCode = crypto.randomUUID();
    const tokenId = `vt_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b: number) => b.toString(16).padStart(2, "0")).join("")}`;

    await db.insert(verificationTokens).values({
      id: tokenId, userId, type: "STAFF_INVITE", code: tokenCode,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000, used: 0, createdAt: now,
    });

    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, session.orgId));
    const modeParam = mode === "no_login_verify" ? "&mode=verify" : "";
    const activationUrl = `${appBaseUrl}/activate?token=${tokenCode}${modeParam}`;

    try {
      await sendStaffInviteEmail(user.email, user.name, org?.name ?? "your clinic", activationUrl);
    } catch (err) {
      log.error("Failed to send activation email", err, { userId });
      return apiError("Failed to send email. Please try again.", 500);
    }

    log.info("Activation email sent", { targetUserId: userId, mode });
    return apiOk({ sent: true, email: user.email });
  }
);
