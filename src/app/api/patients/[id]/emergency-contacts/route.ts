import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emergencyContacts, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/patients/[id]/emergency-contacts", session);

  try {
    const { id: patientId } = await params;
    const db = getDb();

    // Verify patient belongs to this org
    const [membership] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(
        and(
          eq(organizationPatients.organizationId, session.orgId),
          eq(organizationPatients.patientId, patientId)
        )
      );
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const contacts = await db
      .select()
      .from(emergencyContacts)
      .where(
        and(eq(emergencyContacts.entityType, "PATIENT"), eq(emergencyContacts.entityId, patientId))
      );

    return NextResponse.json({ contacts });
  } catch (error) {
    log.error("Failed to get patient emergency contacts", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
