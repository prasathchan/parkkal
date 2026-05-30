import { NextRequest, NextResponse } from "next/server";
import { like, or, desc, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { patients, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const createPatientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().min(1),
    relationship: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")),
  }).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const db = getDb();

  // Get patients linked to this org
  const orgPatientRows = await db
    .select({ patientId: organizationPatients.patientId, orgPatientCode: organizationPatients.patientCode })
    .from(organizationPatients)
    .where(eq(organizationPatients.organizationId, session.orgId))
    .all();

  const patientIds = orgPatientRows.map(r => r.patientId);

  if (patientIds.length === 0) return NextResponse.json({ patients: [] });

  let results;
  if (search) {
    const likeSearch = `%${search}%`;
    results = await db
      .select()
      .from(patients)
      .where(
        or(
          like(patients.name, likeSearch),
          like(patients.phone, likeSearch),
          like(patients.patientCode, likeSearch)
        )
      )
      .orderBy(desc(patients.createdAt))
      .all();
    results = results.filter(p => patientIds.includes(p.id));
  } else {
    results = await db.select().from(patients).orderBy(desc(patients.createdAt)).all();
    results = results.filter(p => patientIds.includes(p.id));
  }

  return NextResponse.json({ patients: results });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createPatientSchema.parse(body);

    const db = getDb();

    // Generate org-specific patient code (PKL-XXXX)
    const [{ orgCount }] = await db
      .select({ orgCount: count() })
      .from(organizationPatients)
      .where(eq(organizationPatients.organizationId, session.orgId));

    const orgCode = `${session.orgSlug.toUpperCase().slice(0, 3)}-${String((orgCount as number) + 1).padStart(4, "0")}`;

    // Also get total patient count for global patient code
    const [{ totalCount }] = await db.select({ totalCount: count() }).from(patients);
    const globalCode = `PKL-${String((totalCount as number) + 1).padStart(4, "0")}`;

    const now = Date.now();
    const patientId = generateId();

    const newPatient = {
      id: patientId,
      patientCode: globalCode,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      dateOfBirth: data.dateOfBirth || null,
      gender: data.gender || null,
      address: data.address || null,
      medicalHistory: data.medicalHistory || null,
      panNumber: data.panNumber || null,
      aadhaarNumber: data.aadhaarNumber || null,
      emergencyContactAdded: data.emergencyContact ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(patients).values(newPatient);

    // Link patient to org
    await db.insert(organizationPatients).values({
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      patientId,
      patientCode: orgCode,
      registeredAt: now,
      isActive: 1,
    });

    // Create emergency contact if provided
    if (data.emergencyContact) {
      const { emergencyContacts } = await import("@/db/schema");
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

    return NextResponse.json({ patient: newPatient }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Create patient error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
