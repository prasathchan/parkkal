import { eq, sql } from "drizzle-orm";
import { patients, organizationPatients, patientCodeSequences } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { generateId } from "@/lib/utils";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const rowSchema = z.object({
  name:          z.string().min(1).max(200),
  phone:         z.string().min(6).max(20),
  email:         z.string().email().optional().or(z.literal("")),
  dateOfBirth:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  gender:        z.enum(["MALE", "FEMALE", "OTHER"]).optional().or(z.literal("")),
  bloodGroup:    z.string().max(10).optional().or(z.literal("")),
  medicalNotes:  z.string().max(2000).optional().or(z.literal("")),
});

const bodySchema = z.object({
  patients: z.array(rowSchema).min(1).max(1000),
});

const BATCH_SIZE = 100;

export const POST = withRoute(
  {
    route: "POST /api/patients/import",
    rateLimit: RATE_LIMITS.WRITE,
    permission: PERMISSIONS.PATIENTS_CREATE,
  },
  async (req, { session, db }) => {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return apiError("Invalid import data", 422);

    const rows = parsed.data.patients;
    const now = Date.now();
    const globalScope = "global";
    const orgScope = `org:${session.orgSlug}`;
    const n = rows.length;

    // Atomically reserve N patient code slots in one DB round-trip each.
    const [globalRow, orgRow] = await Promise.all([
      db
        .insert(patientCodeSequences)
        .values({ scope: globalScope, lastSeq: n, updatedAt: now })
        .onConflictDoUpdate({
          target: patientCodeSequences.scope,
          set: { lastSeq: sql`${patientCodeSequences.lastSeq} + ${n}`, updatedAt: now },
        })
        .returning({ lastSeq: patientCodeSequences.lastSeq }),
      db
        .insert(patientCodeSequences)
        .values({ scope: orgScope, lastSeq: n, updatedAt: now })
        .onConflictDoUpdate({
          target: patientCodeSequences.scope,
          set: { lastSeq: sql`${patientCodeSequences.lastSeq} + ${n}`, updatedAt: now },
        })
        .returning({ lastSeq: patientCodeSequences.lastSeq }),
    ]);

    const globalEnd = Number(globalRow[0].lastSeq);
    const orgEnd    = Number(orgRow[0].lastSeq);
    const globalStart = globalEnd - n + 1;
    const orgStart    = orgEnd    - n + 1;

    const orgPrefix = session.orgSlug.toUpperCase().slice(0, 3);

    let imported = 0;
    const errors: { row: number; message: string }[] = [];

    // Process in batches of BATCH_SIZE
    for (let batchStart = 0; batchStart < n; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

      const patientValues = batch.map((row, i) => {
        const idx = batchStart + i;
        const globalCode = `PKL-${String(globalStart + idx).padStart(6, "0")}`;
        return {
          id:            generateId(),
          patientCode:   globalCode,
          name:          row.name,
          phone:         row.phone,
          email:         row.email || null,
          dateOfBirth:   row.dateOfBirth || null,
          gender:        (row.gender as "MALE" | "FEMALE" | "OTHER" | null) || null,
          bloodGroup:    row.bloodGroup || null,
          medicalHistory: row.medicalNotes || null,
          address:       null,
          panNumber:     null,
          aadhaarNumber: null,
          emergencyContactAdded: 0,
          referralSource: null,
          referredByPatientId: null,
          dataConsentAt: now,
          dataConsentIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          createdAt:     now,
          updatedAt:     now,
        };
      });

      const orgPatientValues = patientValues.map((p, i) => {
        const idx = batchStart + i;
        const orgCode = `${orgPrefix}-${String(orgStart + idx).padStart(4, "0")}`;
        return {
          id:             crypto.randomUUID(),
          organizationId: session.orgId,
          patientId:      p.id,
          patientCode:    orgCode,
          registeredAt:   now,
          isActive:       1,
        };
      });

      try {
        await db.insert(patients).values(patientValues);
        await db.insert(organizationPatients).values(orgPatientValues);
        imported += batch.length;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        for (let i = 0; i < batch.length; i++) {
          errors.push({ row: batchStart + i + 2, message: msg }); // +2: 1-indexed + header row
        }
      }
    }

    return apiOk({ imported, errors, total: n });
  }
);
