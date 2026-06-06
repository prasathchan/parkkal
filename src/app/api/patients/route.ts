/**
 * API Route: /api/patients
 *
 * GET  — List patients for the current org (paginated, searchable)
 * POST — Create a new patient record
 *
 * Who can call this:
 *   GET  → any logged-in staff with patients.view permission
 *   POST → staff with patients.create permission
 *
 * Request / response shapes live in: src/api/patients.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { like, or, desc, count, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { patients, organizationPatients, emergencyContacts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { encryptField } from "@/lib/encryption";
import { z } from "zod";

const createPatientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().refine(
    (v) => { const d = v.replace(/\D/g, ""); return d.length >= 10 && d.length <= 15; },
    "Phone must have 10–15 digits"
  ),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z.string().max(500).optional(),
  medicalHistory: z.string().max(5000).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1),
      relationship: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().optional().or(z.literal("")),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/patients", session);
  if (!await hasPermission(session, PERMISSIONS.PATIENTS_VIEW)) {
    log.security("Permission denied: patients.view", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const limit = Math.min(Number(searchParams.get("limit") || "25"), 100);
  const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);

  const db = getDb();

  const baseConditions = and(
    eq(organizationPatients.organizationId, session.orgId),
    eq(organizationPatients.isActive, 1)
  );

  // Escape LIKE special characters so user input is treated as a literal substring.
  const escapedSearch = search?.replace(/[%_\\]/g, "\\$&");
  const whereCondition = escapedSearch
    ? and(
        baseConditions,
        or(
          like(patients.name, `%${escapedSearch}%`),
          like(patients.phone, `%${escapedSearch}%`),
          like(patients.patientCode, `%${escapedSearch}%`)
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
        // medicalHistory intentionally excluded from list view — it contains sensitive PHI.
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

  // PAN and Aadhaar are sensitive Indian government IDs; mask all but last 4 digits in lists.
  const masked = results.map((p: PatientRow) => ({
    ...p,
    panNumber: null,   // never expose even masked in list — only show in detail view
    aadhaarNumber: null,
  }));

  return NextResponse.json({ patients: masked, total, limit, offset });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/patients", session);
  if (!await hasPermission(session, PERMISSIONS.PATIENTS_CREATE)) {
    log.security("Permission denied: patients.create", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createPatientSchema.parse(body);

    const db = getDb();
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
      createdAt: now,
      updatedAt: now,
    };

    // Retry loop handles race condition: two concurrent requests may compute the same count.
    // On UNIQUE constraint collision, re-count and retry.
    let newPatient: typeof basePatient & { patientCode: string } = {
      ...basePatient,
      patientCode: "",
    };
    let orgCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const [{ orgCount }] = await db
        .select({ orgCount: count() })
        .from(organizationPatients)
        .where(eq(organizationPatients.organizationId, session.orgId));
      const [{ totalCount }] = await db.select({ totalCount: count() }).from(patients);

      const seq = (totalCount as number) + 1 + attempt;
      const globalCode = `PKL-${String(seq).padStart(6, "0")}`;
      // orgCount is re-queried on each attempt, so no +attempt offset needed here.
      orgCode = `${session.orgSlug.toUpperCase().slice(0, 3)}-${String(
        (orgCount as number) + 1
      ).padStart(4, "0")}`;
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
    return NextResponse.json({ patient: newPatient }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    log.error("Failed to create patient", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
