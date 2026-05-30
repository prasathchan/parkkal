import { NextRequest, NextResponse } from "next/server";
import { like, or, desc, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { patients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { generateId, generatePatientCode } from "@/lib/utils";
import { z } from "zod";

const createPatientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const db = getDb();

  let query = db.select().from(patients).orderBy(desc(patients.createdAt));

  if (search) {
    const likeSearch = `%${search}%`;
    const results = await db
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
    return NextResponse.json({ patients: results });
  }

  const results = await query.all();
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

    // Get current patient count for code generation
    const [{ value: patientCount }] = await db
      .select({ value: count() })
      .from(patients);

    const now = Date.now();
    const newPatient = {
      id: generateId(),
      patientCode: generatePatientCode((patientCount as number) + 1),
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      dateOfBirth: data.dateOfBirth || null,
      gender: data.gender || null,
      address: data.address || null,
      medicalHistory: data.medicalHistory || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(patients).values(newPatient);
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
