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
import { like, or, desc, count, eq, and } from "drizzle-orm";
import { patients, organizationPatients, emergencyContacts } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { generateId, escapeLike } from "@/lib/utils";
import { encryptField } from "@/lib/encryption";
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

    // PAN and Aadhaar are sensitive Indian government IDs; never expose in list view.
    const masked = results.map((p: PatientRow) => ({
      ...p,
      panNumber: null,
      aadhaarNumber: null,
    }));

    return apiOk({ patients: masked, total, limit, offset });
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
      dateOfBirth: data.dateOfBirth || null,
      gender: data.gender || null,
      address: data.address || null,
      medicalHistory: data.medicalHistory || null,
      bloodGroup: data.bloodGroup || null,
      panNumber: await encryptField(data.panNumber || null) ?? null,
      aadhaarNumber: await encryptField(data.aadhaarNumber || null) ?? null,
      emergencyContactAdded: data.emergencyContact ? 1 : 0,
      referralSource: data.referralSource || null,
      referredByPatientId: data.referredByPatientId || null,
      createdAt: now,
      updatedAt: now,
    };

    // Retry loop handles race condition: two concurrent requests may compute the same code.
    // On UNIQUE constraint collision, re-count and retry.
    let newPatient: typeof basePatient & { patientCode: string } = {
      ...basePatient,
      patientCode: "",
    };
    const [{ orgCount }] = await db
      .select({ orgCount: count() })
      .from(organizationPatients)
      .where(eq(organizationPatients.organizationId, session.orgId));
    const orgCode = `${session.orgSlug.toUpperCase().slice(0, 3)}-${String(
      (orgCount as number) + 1
    ).padStart(4, "0")}`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const [{ totalCount }] = await db.select({ totalCount: count() }).from(patients);

      const seq = (totalCount as number) + 1 + attempt;
      const globalCode = `PKL-${String(seq).padStart(6, "0")}`;
      newPatient = { ...basePatient, patientCode: globalCode };

      try {
        await db.insert(patients).values(newPatient);
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt === 4 || !msg.includes("UNIQUE")) throw e;
      }
    }

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
        phone: data.emergencyContact.phone,
        email: data.emergencyContact.email || null,
        address: null,
        createdAt: now,
      });
    }

    log.info("Patient created", { patientId, patientCode: newPatient.patientCode, orgCode });
    return apiOk({ patient: newPatient }, 201);
  }
);
