import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emergencyContacts, patients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
  entityType: z.enum(["USER", "PATIENT"]),
  entityId: z.string().min(1),
  name: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const db = getDb();
    const now = Date.now();

    const contact = {
      id: crypto.randomUUID(),
      entityType: data.entityType,
      entityId: data.entityId,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      createdAt: now,
    };

    await db.insert(emergencyContacts).values(contact);

    // Update patient flag if needed
    if (data.entityType === "PATIENT") {
      await db.update(patients).set({ emergencyContactAdded: 1 }).where(eq(patients.id, data.entityId));
    }

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Create emergency contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
