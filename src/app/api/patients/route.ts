import { NextRequest, NextResponse } from "next/server";
import { like, or, desc, count, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { patients, organizationPatients, emergencyContacts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const createPatientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
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
  const limit = Math.min(Number(searchParams.get("limit") || "200"), 500);

  const db = getDb();

  const baseConditions = and(
    eq(organizationPatients.organizationId, session.orgId),
    eq(organizationPatients.isActive, 1)
  );

  const whereCondition = search
    ? and(
        baseConditions,
        or(
          like(patients.name, `%${search}%`),
          like(patients.phone, `%${search}%`),
          like(patients.patientCode, `%${search}%`)
        )
      )
    : baseConditions;

  const results = await db
    .select({
      id: patients.id,
      patientCode: patients.patientCode,
      name: patients.name,
      phone: patients.phone,
      email: patients.email,
      dateOfBirth: patients.dateOfBirth,
      gender: patients.gender,
      address: patients.address,
      medicalHistory: patients.medicalHistory,
      bloodGroup: patients.bloodGroup,
      panNumber: patients.panNumber,
      aadhaarNumber: patients.aadhaarNumber,
      emergencyContactAdded: patients.emergencyContactAdded,
      createdAt: patients.createdAt,
      updatedAt: patients.updatedAt,
    })
    .from(patients)
    .innerJoin(organizationPatients, eq(organizationPatients.patientId, patients.id))
    .where(whereCondition)
    .orderBy(desc(patients.createdAt))
    .limit(limit);

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

    const [{ orgCount }] = await db
      .select({ orgCount: count() })
      .from(organizationPatients)
      .where(eq(organizationPatients.organizationId, session.orgId));

    const orgCode = `${session.orgSlug.toUpperCase().slice(0, 3)}-${String((orgCount as number) + 1).padStart(4, "0")}`;

    const [{ totalCount }] = await db.select({ totalCount: count() }).from(patients);
    const globalCode = `PKL-${String((totalCount as number) + 1).padStart(6, "0")}`;

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
      bloodGroup: data.bloodGroup || null,
      panNumber: data.panNumber || null,
      aadhaarNumber: data.aadhaarNumber || null,
      emergencyContactAdded: data.emergencyContact ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    };

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
