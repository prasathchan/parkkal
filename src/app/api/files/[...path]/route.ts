import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attachments, visits, organizationPatients, organizations, treatments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getFile } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Reject path traversal
  if (segments.some((s) => s.includes("..") || s.includes("/"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const folder = segments[0];

  // ── Logo: /api/files/logos/<fileName> ─────────────────────────────────────
  if (folder === "logos") {
    const db = getDb();
    const [org] = await db
      .select({ logoUrl: organizations.logoUrl })
      .from(organizations)
      .where(eq(organizations.id, session.orgId));

    const expectedUrl = `/api/files/${segments.join("/")}`;
    if (!org || org.logoUrl !== expectedUrl) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const file = await getFile(segments.join("/"));
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    return new NextResponse(file.data, {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "private, max-age=86400",
        "Content-Disposition": `inline; filename="${segments[segments.length - 1]}"`,
      },
    });
  }

  // ── Consent document: /api/files/consents/<treatmentId>/<fileName> ───────
  if (folder === "consents" && segments.length === 3) {
    const treatmentId = segments[1];
    const db = getDb();

    // Verify treatment belongs to this org
    const [treatment] = await db
      .select({ id: treatments.id, organizationId: treatments.organizationId, consentDocumentUrl: treatments.consentDocumentUrl })
      .from(treatments)
      .where(and(eq(treatments.id, treatmentId), eq(treatments.organizationId, session.orgId)));

    if (!treatment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Ensure requested file matches the stored consent document URL
    const expectedUrl = `/api/files/${segments.join("/")}`;
    if (treatment.consentDocumentUrl !== expectedUrl) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const file = await getFile(segments.join("/"));
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const fileName = segments[segments.length - 1];
    return new NextResponse(file.data, {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  }

  // ── Patient file: /api/files/patients/<patientId>/<fileName> ─────────────
  // Also supports legacy format /api/files/<patientId>/<fileName>
  let patientId: string;
  let storageKey: string;

  if (folder === "patients" && segments.length === 3) {
    patientId = segments[1];
    storageKey = segments.join("/");
  } else if (segments.length === 2) {
    // Legacy format — migrate key to new structure transparently
    patientId = segments[0];
    storageKey = `patients/${segments[0]}/${segments[1]}`;
  } else {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();

  // Verify patient belongs to this org
  const [orgLink] = await db
    .select({ patientId: organizationPatients.patientId })
    .from(organizationPatients)
    .where(
      and(
        eq(organizationPatients.organizationId, session.orgId),
        eq(organizationPatients.patientId, patientId)
      )
    );
  if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fileName = segments[segments.length - 1];

  // Verify attachment record exists
  const [att] = await db
    .select({ id: attachments.id, mimeType: attachments.mimeType, visitId: attachments.visitId })
    .from(attachments)
    .where(and(eq(attachments.patientId, patientId), eq(attachments.fileName, fileName)));
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify the visit belongs to this org
  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, att.visitId), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const file = await getFile(storageKey);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  return new NextResponse(file.data, {
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
