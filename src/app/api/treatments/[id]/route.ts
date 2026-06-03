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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [existing] = await db
    .select({ id: treatments.id, organizationId: treatments.organizationId })
    .from(treatments)
    .where(eq(treatments.id, id));

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

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

  const { id } = await params;
  const db = getDb();

  const [existing] = await db
    .select({ id: treatments.id, organizationId: treatments.organizationId })
    .from(treatments)
    .where(eq(treatments.id, id));

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(treatments).where(
    and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId))
  );

  return NextResponse.json({ success: true });
}
