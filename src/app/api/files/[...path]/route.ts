import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { attachments, visits, organizationPatients, organizations, treatments } from "@/db/schema";
import { getFile } from "@/lib/storage";
import { withRoute, apiError, RATE_LIMITS } from "@/lib/api";

export const GET = withRoute(
  { route: "GET /api/files/[...path]", rateLimit: RATE_LIMITS.READ },
  async (req, { session, db }) => {
    const url = new URL(req.url);
    // Extract path segments from the URL (everything after /api/files/)
    const rawPath = url.pathname.replace(/^\/api\/files\//, "");
    const segments = rawPath.split("/").filter(Boolean);

    if (!segments || segments.length < 2) return apiError("Not found", 404);

    // Reject path traversal
    if (segments.some((s) => s.includes("..") || s.includes("/"))) {
      return apiError("Forbidden", 403);
    }

    const folder = segments[0];

    // ── Logo: /api/files/logos/<fileName> ─────────────────────────────────────
    if (folder === "logos") {
      const [org] = await db
        .select({ logoUrl: organizations.logoUrl })
        .from(organizations)
        .where(eq(organizations.id, session.orgId));

      const expectedUrl = `/api/files/${segments.join("/")}`;
      if (!org || org.logoUrl !== expectedUrl) return apiError("Forbidden", 403);

      const file = await getFile(segments.join("/"));
      if (!file) return apiError("File not found", 404);

      return new NextResponse(file.data, {
        headers: {
          "Content-Type": file.mimeType,
          "Cache-Control": "private, no-cache, must-revalidate",
          "Content-Disposition": `inline; filename="${segments[segments.length - 1]}"`,
        },
      });
    }

    // ── Consent document: /api/files/consents/<treatmentId>/<fileName> ───────
    if (folder === "consents" && segments.length === 3) {
      const treatmentId = segments[1];

      const [treatment] = await db
        .select({ id: treatments.id, organizationId: treatments.organizationId, consentDocumentUrl: treatments.consentDocumentUrl })
        .from(treatments)
        .where(and(eq(treatments.id, treatmentId), eq(treatments.organizationId, session.orgId)));

      if (!treatment) return apiError("Forbidden", 403);

      const expectedUrl = `/api/files/${segments.join("/")}`;
      if (treatment.consentDocumentUrl !== expectedUrl) return apiError("Forbidden", 403);

      const file = await getFile(segments.join("/"));
      if (!file) return apiError("File not found", 404);

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
      return apiError("Not found", 404);
    }

    // Verify patient belongs to this org
    const [orgLink] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(and(
        eq(organizationPatients.organizationId, session.orgId),
        eq(organizationPatients.patientId, patientId)
      ));
    if (!orgLink) return apiError("Forbidden", 403);

    const fileName = segments[segments.length - 1];

    // Verify attachment record exists
    const [att] = await db
      .select({ id: attachments.id, mimeType: attachments.mimeType, visitId: attachments.visitId })
      .from(attachments)
      .where(and(eq(attachments.patientId, patientId), eq(attachments.fileName, fileName)));
    if (!att) return apiError("Not found", 404);

    // Verify the visit belongs to this org
    const [visit] = await db
      .select({ organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, att.visitId), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Forbidden", 403);

    const file = await getFile(storageKey);
    if (!file) return apiError("File not found", 404);

    return new NextResponse(file.data, {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  }
// Cast required: Next.js expects params: Promise<{ path: string[] }> for catch-all routes,
// but withRoute's outer signature uses Record<string, string | string[]>. Runtime is identical
// since we extract the path from the URL, not from params.
) as (request: NextRequest, context: { params: Promise<{ path: string[] }> }) => Promise<Response>;
