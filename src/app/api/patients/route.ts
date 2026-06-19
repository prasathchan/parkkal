/**
 * API Route: /api/patients
 *
 * GET  — List patients for the current org (paginated, searchable)
 * POST — Create a new patient record
 *
 * Who can call this:
 *   GET  → any logged-in staff with patients.view permission
 *   POST → staff with patients.create permission
 */
import { like, or, desc, count, eq, and, sql } from "drizzle-orm";
import { patients, organizationPatients, emergencyContacts, patientCodeSequences } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { generateId, escapeLike } from "@/lib/utils";
import { encryptField, decryptField } from "@/lib/encryption";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { createPatientSchema } from "@/lib/schemas/patient";

// ─── GET /api/patients ────────────────────────────────────────────────────────
// Returns a paginated + searchable list of patients belonging to the org.
// Sensitive fields (PAN, Aadhaar, medical history) are intentionally excluded.

export const GET = withRoute(
  { route: "GET /api/patients", permission: PERMISSIONS.PATIENTS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const limit = Math.min(Number(searchParams.get("limit") || "25"), 100);
    const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);

    // Base filter: only patients linked to the current org and not soft-deleted
    const baseConditions = and(
      eq(organizationPatients.organizationId, session.orgId),
      eq(organizationPatients.isActive, 1)
    );

    // Escape LIKE special characters so user input is treated as a literal substring
    const escaped = escapeLike(search);
    const whereCondition = escaped
      ? and(
          baseConditions,
          or(
            like(patients.name, `%${escaped}%`),
            like(patients.phone, `%${escaped}%`),
            like(patients.patientCode, `%${escaped}%`)
          )
        )
      : baseConditions;

    const [totalRow, results] = await Promise.all([
      db
        .select({ total: count() })
        .from(patients)
        .innerJoin(organizationPatients, eq(organizationPatients.patientId, patients.id))
        .where(whereCondition),
      db
        .select({
          id: patients.id,
          patientCode: patients.patientCode,
          name: patients.name,
          phone: patients.phone,
          email: patients.email,
          dateOfBirth: patients.dateOfBirth,
          gender: patients.gender,
          bloodGroup: patients.bloodGroup,
          emergencyContactAdded: patients.emergencyContactAdded,
          createdAt: patients.createdAt,
          updatedAt: patients.updatedAt,
          // medicalHistory intentionally excluded — it contains sensitive PHI.
          // Fetch it only from the individual patient detail endpoint.
        })
        .from(patients)
        .innerJoin(organizationPatients, eq(organizationPatients.patientId, patients.id))
        .where(whereCondition)
        .orderBy(desc(patients.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalRow[0]?.total ?? 0;

    type PatientRow = (typeof results)[number];

    // Decrypt DOB per row; strip government IDs entirely from list view.
    const decrypted = await Promise.all(results.map(async (p: PatientRow) => ({
      ...p,
      dateOfBirth:  await decryptField(p.dateOfBirth) ?? null,
      panNumber:    null,
      aadhaarNumber: null,
    })));

    return apiOk({ patients: decrypted, total, limit, offset });
  }
);

// ─── POST /api/patients ───────────────────────────────────────────────────────
// Creates a new patient record.
// Includes a retry loop to handle race conditions on patient code generation.

export const POST = withRoute(
  {
    route: "POST /api/patients",
    permission: PERMISSIONS.PATIENTS_CREATE,
    rateLimit: RATE_LIMITS.WRITE,
  },
  async (req, { session, db, log }) => {
    const body = await req.json();
    const data = createPatientSchema.parse(body); // throws ZodError → caught by withRoute → 400

    const now = Date.now();
    const patientId = generateId();

    const basePatient = {
      id: patientId,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      dateOfBirth:    await encryptField(data.dateOfBirth || null) ?? null,
      gender: data.gender || null,
      address:        await encryptField(data.address || null) ?? null,
      medicalHistory: await encryptField(data.medicalHistory || null) ?? null,
      bloodGroup: data.bloodGroup || null,
      panNumber: await encryptField(data.panNumber || null) ?? null,
      aadhaarNumber: await encryptField(data.aadhaarNumber || null) ?? null,
      emergencyContactAdded: data.emergencyContact ? 1 : 0,
      referralSource: data.referralSource || null,
      referredByPatientId: data.referredByPatientId || null,
      dataConsentAt: now,
      dataConsentIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("cf-connecting-ip") ?? null,
      createdAt: now,
      updatedAt: now,
    };

    // Atomically increment the global sequence and get the new value in one statement.
    // This eliminates the SELECT COUNT(*) race that could produce duplicate patient codes.
    const globalScope = "global";
    const orgScope = `org:${session.orgSlug}`;

    const [globalRow, orgRow] = await Promise.all([
      db
        .insert(patientCodeSequences)
        .values({ scope: globalScope, lastSeq: 1, updatedAt: now })
        .onConflictDoUpdate({
          target: patientCodeSequences.scope,
          set: { lastSeq: sql`${patientCodeSequences.lastSeq} + 1`, updatedAt: now },
        })
        .returning({ lastSeq: patientCodeSequences.lastSeq }),
      db
        .insert(patientCodeSequences)
        .values({ scope: orgScope, lastSeq: 1, updatedAt: now })
        .onConflictDoUpdate({
          target: patientCodeSequences.scope,
          set: { lastSeq: sql`${patientCodeSequences.lastSeq} + 1`, updatedAt: now },
        })
        .returning({ lastSeq: patientCodeSequences.lastSeq }),
    ]);

    const globalCode = `PKL-${String(globalRow[0].lastSeq).padStart(6, "0")}`;
    const orgCode = `${session.orgSlug.toUpperCase().slice(0, 3)}-${String(orgRow[0].lastSeq).padStart(4, "0")}`;

    const newPatient = { ...basePatient, patientCode: globalCode };
    await db.insert(patients).values(newPatient);

    await db.insert(organizationPatients).values({
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      patientId,
      patientCode: orgCode,
      registeredAt: now,
      isActive: 1,
    });

    if (data.emergencyContact) {
      await db.insert(emergencyContacts).values({
        id: crypto.randomUUID(),
        entityType: "PATIENT",
        entityId: patientId,
        name: data.emergencyContact.name,
        relationship: data.emergencyContact.relationship,
        phone:   await encryptField(data.emergencyContact.phone) ?? data.emergencyContact.phone,
        email:   await encryptField(data.emergencyContact.email || null) ?? null,
        address: null,
        createdAt: now,
      });
    }

    log.info("Patient created", { patientId, patientCode: newPatient.patientCode, orgCode });
    return apiOk({ patient: newPatient }, 201);
  }
);
