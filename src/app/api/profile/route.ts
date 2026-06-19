import { eq } from "drizzle-orm";
import { staffProfiles, users } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { encryptField, decryptField } from "@/lib/encryption";
import { z } from "zod";

const qualificationSchema = z.object({
  id: z.string(),
  degree: z.string().min(1).max(100),
  institution: z.string().min(1).max(200),
  year: z.string().max(4),
  notes: z.string().max(500).optional(),
});

const patchSchema = z.object({
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
  // Personal info staff can update themselves
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).nullable().optional(),
  dateOfBirth: z.string().max(10).nullable().optional(),
  gender: z.string().max(10).nullable().optional(),
});

/** GET /api/profile — own profile + professional profile */
export const GET = withRoute(
  { route: "GET /api/profile", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }) => {
    const [user] = await db
      .select({ name: users.name, email: users.email, phone: users.phone, dateOfBirth: users.dateOfBirth, gender: users.gender, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(eq(users.id, session.userId));
    if (!user) return apiError("User not found", 404);

    const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, session.userId));

    return apiOk({
      user: { ...user, id: session.userId, role: session.role, dateOfBirth: await decryptField(user.dateOfBirth) ?? null },
      profile: profile ? {
        ...profile,
        languages: JSON.parse(profile.languages ?? "[]"),
        qualifications: JSON.parse(profile.qualifications ?? "[]"),
        documents: JSON.parse(profile.documents ?? "[]"),
      } : null,
    });
  }
);

/** PATCH /api/profile — staff updates their own profile info */
export const PATCH = withRoute(
  { route: "PATCH /api/profile", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }) => {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Invalid input", 400, parsed.error.flatten().fieldErrors);

    const data = parsed.data;
    const now = Date.now();

    // Update users table fields (personal info)
    const userUpdates: Record<string, unknown> = {};
    if (data.name !== undefined) userUpdates.name = data.name;
    if (data.phone !== undefined) userUpdates.phone = data.phone;
    if (data.dateOfBirth !== undefined) userUpdates.dateOfBirth = await encryptField(data.dateOfBirth) ?? null;
    if (data.gender !== undefined) userUpdates.gender = data.gender;
    if (Object.keys(userUpdates).length > 0) {
      userUpdates.updatedAt = now;
      await db.update(users).set(userUpdates).where(eq(users.id, session.userId));
    }

    // Upsert professional profile (non-document fields only)
    const [existing] = await db.select({ userId: staffProfiles.userId }).from(staffProfiles).where(eq(staffProfiles.userId, session.userId));

    if (existing) {
      const profUpdates: Record<string, unknown> = { updatedAt: now };
      if (data.bio !== undefined) profUpdates.bio = data.bio;
      if (data.specialization !== undefined) profUpdates.specialization = data.specialization;
      if (data.yearsExperience !== undefined) profUpdates.yearsExperience = data.yearsExperience;
      if (data.languages !== undefined) profUpdates.languages = JSON.stringify(data.languages);
      if (data.qualifications !== undefined) profUpdates.qualifications = JSON.stringify(data.qualifications);
      if (data.idaNumber !== undefined) profUpdates.idaNumber = data.idaNumber;
      if (data.dciNumber !== undefined) profUpdates.dciNumber = data.dciNumber;
      if (data.stateCouncilNumber !== undefined) profUpdates.stateCouncilNumber = data.stateCouncilNumber;
      if (data.licenseExpiry !== undefined) profUpdates.licenseExpiry = data.licenseExpiry;
      if (data.previousEmployer !== undefined) profUpdates.previousEmployer = data.previousEmployer;
      await db.update(staffProfiles).set(profUpdates).where(eq(staffProfiles.userId, session.userId));
    } else if (data.bio !== undefined || data.specialization !== undefined || data.qualifications !== undefined) {
      await db.insert(staffProfiles).values({
        userId: session.userId,
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

    log.info("Staff updated own profile");
    return apiOk({ success: true });
  }
);
