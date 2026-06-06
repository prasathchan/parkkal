import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prescriptions, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { z } from "zod";

const medicineSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  notes: z.string().optional(),
});

const createSchema = z.object({
  medicines: z.array(medicineSchema).min(1),
  instructions: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/visits/[id]/prescriptions", session);
  if (!await hasPermission(session, PERMISSIONS.VISITS_VIEW)) {
    log.security("Permission denied: VISITS_VIEW", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(prescriptions)
    .where(and(eq(prescriptions.visitId, id), eq(prescriptions.organizationId, session.orgId)));

  return NextResponse.json({ prescriptions: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/visits/[id]/prescriptions", session);
  if (!await hasPermission(session, PERMISSIONS.VISITS_EDIT)) {
    log.security("Permission denied: VISITS_EDIT", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  // Fetch visit to get authoritative patientId/doctorId — never trust caller for these
  const [visit] = await db
    .select({ organizationId: visits.organizationId, patientId: visits.patientId, doctorId: visits.doctorId, status: visits.status })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  if (visit.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot add prescription to a cancelled visit" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const rxId = crypto.randomUUID();
  const now = Date.now();

  const [prescription] = await db
    .insert(prescriptions)
    .values({
      id: rxId,
      organizationId: session.orgId,
      visitId: id,
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      medicines: JSON.stringify(data.medicines),
      instructions: data.instructions ?? null,
      createdAt: now,
    })
    .returning();

  log.info("Prescription created", { prescriptionId: rxId, visitId: id });
  return NextResponse.json({ prescription }, { status: 201 });
}
