import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]).optional(),
  description: z.string().min(1).optional(),
  procedure: z.string().optional().nullable(),
  toothNumbers: z.string().optional().nullable(),
  cost: z.number().min(0).optional(),
  visitId: z.string().nullable().optional(),
});

// Valid forward transitions for non-ADMIN roles.
// ADMIN can freely correct status; doctors follow the clinical state machine.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED"],
  IN_PROGRESS: ["COMPLETED", "PLANNED"],
  COMPLETED: [], // only ADMIN can reopen a completed treatment
};

// Clinical narrative fields require a clinical role to edit
const CLINICAL_ROLES = ["ADMIN", "DOCTOR", "NURSE"];
// Broader set that may edit cost, visitId, and status
const TREATMENT_EDIT_ROLES = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!TREATMENT_EDIT_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const [existing] = await db
    .select({ id: treatments.id, status: treatments.status })
    .from(treatments)
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    // Clinical narrative fields are PHI — restrict to clinical roles
    const hasClinicalEdits =
      data.description !== undefined ||
      data.procedure !== undefined ||
      data.toothNumbers !== undefined;
    if (hasClinicalEdits && !CLINICAL_ROLES.includes(session.role)) {
      return NextResponse.json(
        { error: "Forbidden: only clinical staff can edit treatment details" },
        { status: 403 }
      );
    }

    // Enforce status state machine for non-ADMIN roles
    if (data.status !== undefined && data.status !== existing.status) {
      if (session.role !== "ADMIN") {
        const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(data.status)) {
          return NextResponse.json(
            { error: `Cannot transition treatment from ${existing.status} to ${data.status}` },
            { status: 422 }
          );
        }
      }
    }

    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.description !== undefined) updates.description = data.description;
    if (data.procedure !== undefined) updates.procedure = data.procedure;
    if (data.toothNumbers !== undefined) updates.toothNumbers = data.toothNumbers;
    if (data.cost !== undefined) updates.cost = data.cost;
    if (data.visitId !== undefined) updates.visitId = data.visitId;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.update(treatments).set(updates).where(
      and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Treatment deletion is irreversible clinical record destruction — ADMIN and DOCTOR only
  if (!["ADMIN", "DOCTOR"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const [existing] = await db
    .select({ id: treatments.id })
    .from(treatments)
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(treatments).where(
    and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId))
  );

  return NextResponse.json({ success: true });
}
