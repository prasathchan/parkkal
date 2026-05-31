import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]).optional(),
  description: z.string().min(1).optional(),
  procedure: z.string().optional(),
  toothNumbers: z.string().optional(),
  cost: z.number().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    const db = getDb();

    const [existing] = await db
      .select({ id: treatments.id })
      .from(treatments)
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

    if (!existing) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
    }

    await db
      .update(treatments)
      .set({ ...data })
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

    const [updated] = await db.select().from(treatments).where(eq(treatments.id, id));

    return NextResponse.json({ treatment: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Update treatment error:", error);
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
    .select({ id: treatments.id })
    .from(treatments)
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

  if (!existing) {
    return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
  }

  await db
    .delete(treatments)
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

  return NextResponse.json({ success: true });
}
