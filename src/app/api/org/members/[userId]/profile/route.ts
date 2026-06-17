import { eq, and } from "drizzle-orm";
import { staffProfiles, organizationMembers } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const qualificationSchema = z.object({
  id: z.string(),
  degree: z.string().min(1).max(100),
  institution: z.string().min(1).max(200),
  year: z.string().max(4),
  notes: z.string().max(500).optional(),
});

const putSchema = z.object({
  bio: z.string().max(2000).nullable().optional(),
  specialization: z.string().max(200).nullable().optional(),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  languages: z.array(z.string().max(50)).max(20).optional(),
  qualifications: z.array(qualificationSchema).max(20).optional(),
  idaNumber: z.string().max(50).nullable().optional(),
  dciNumber: z.string().max(50).nullable().optional(),
  stateCouncilNumber: z.string().max(50).nullable().optional(),
  licenseExpiry: z.string().max(10).nullable().optional(),
  previousEmployer: z.string().max(300).nullable().optional(),
});

/** GET /api/org/members/[userId]/profile */
export const GET = withRoute<{ userId: string }>(
  { route: "GET /api/org/members/[userId]/profile", permission: PERMISSIONS.STAFF_VIEW },
  async (_req, { session, db }, { userId }) => {
    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!membership) return apiError("Member not found", 404);

    const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId));
    if (!profile) return apiOk({ profile: null });

    return apiOk({
      profile: {
        ...profile,
        languages: JSON.parse(profile.languages ?? "[]"),
        qualifications: JSON.parse(profile.qualifications ?? "[]"),
        documents: JSON.parse(profile.documents ?? "[]"),
      },
    });
  }
);

/** PUT /api/org/members/[userId]/profile — upsert professional profile */
export const PUT = withRoute<{ userId: string }>(
  { route: "PUT /api/org/members/[userId]/profile", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.STAFF_MANAGE },
  async (req, { session, db, log }, { userId }) => {
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Invalid input", 400, parsed.error.flatten().fieldErrors);

    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!membership) return apiError("Member not found", 404);

    const data = parsed.data;
    const now = Date.now();

    const [existing] = await db.select({ userId: staffProfiles.userId, documents: staffProfiles.documents })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, userId));

    if (existing) {
      await db.update(staffProfiles).set({
        bio: data.bio !== undefined ? data.bio : undefined,
        specialization: data.specialization !== undefined ? data.specialization : undefined,
        yearsExperience: data.yearsExperience !== undefined ? data.yearsExperience : undefined,
        languages: data.languages !== undefined ? JSON.stringify(data.languages) : undefined,
        qualifications: data.qualifications !== undefined ? JSON.stringify(data.qualifications) : undefined,
        idaNumber: data.idaNumber !== undefined ? data.idaNumber : undefined,
        dciNumber: data.dciNumber !== undefined ? data.dciNumber : undefined,
        stateCouncilNumber: data.stateCouncilNumber !== undefined ? data.stateCouncilNumber : undefined,
        licenseExpiry: data.licenseExpiry !== undefined ? data.licenseExpiry : undefined,
        previousEmployer: data.previousEmployer !== undefined ? data.previousEmployer : undefined,
        updatedAt: now,
      }).where(eq(staffProfiles.userId, userId));
    } else {
      await db.insert(staffProfiles).values({
        userId,
        bio: data.bio ?? null,
        specialization: data.specialization ?? null,
        yearsExperience: data.yearsExperience ?? null,
        languages: JSON.stringify(data.languages ?? []),
        qualifications: JSON.stringify(data.qualifications ?? []),
        idaNumber: data.idaNumber ?? null,
        dciNumber: data.dciNumber ?? null,
        stateCouncilNumber: data.stateCouncilNumber ?? null,
        licenseExpiry: data.licenseExpiry ?? null,
        previousEmployer: data.previousEmployer ?? null,
        documents: "[]",
        createdAt: now,
        updatedAt: now,
      });
    }

    const [updated] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId));
    log.info("Staff profile updated", { targetUserId: userId });

    return apiOk({
      profile: {
        ...updated,
        languages: JSON.parse(updated.languages ?? "[]"),
        qualifications: JSON.parse(updated.qualifications ?? "[]"),
        documents: JSON.parse(updated.documents ?? "[]"),
      },
    });
  }
);
