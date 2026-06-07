import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { storeFile } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const UPLOAD_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

type VerifyResult = { legible: boolean; hasSignature: boolean; notes: string };

async function verifyWithClaude(
  base64Data: string,
  mimeType: string
): Promise<VerifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No session context here (module-level function), use sessionless logger
    const log = logger.forRoute("POST /api/treatments/[id]/consent/upload");
    log.warn("ANTHROPIC_API_KEY not set — skipping AI consent verification", {});
    return { legible: true, hasSignature: true, notes: "Auto-approved: AI verification not configured" };
  }

  // PDFs cannot be inspected visually — mark as UPLOADED pending manual review by staff.
  // Auto-approving PDFs without reading them is a clinical compliance risk.
  if (mimeType === "application/pdf") {
    return { legible: true, hasSignature: false, notes: "PDF uploaded — staff must verify signature manually before proceeding" };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64Data },
            },
            {
              type: "text",
              text: `This is a dental patient consent form. Examine the image and respond ONLY with valid JSON in this exact format:
{"legible": boolean, "hasSignature": boolean, "notes": string}

Rules:
- "legible": true if the document text is clearly readable (not blurry, cut off, or too dark)
- "hasSignature": true if there is at least one handwritten signature or initials visible
- "notes": a brief one-sentence explanation of your finding (max 100 chars)

Respond with JSON only, no other text.`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.forRoute("POST /api/treatments/[id]/consent/upload").warn("Claude API error during consent verification", { status: res.status, error: errText });
    return { legible: true, hasSignature: false, notes: "AI verification failed — please review manually" };
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content?.[0]?.text ?? "";

  try {
    const parsed = JSON.parse(text) as VerifyResult;
    return {
      legible: Boolean(parsed.legible),
      hasSignature: Boolean(parsed.hasSignature),
      notes: String(parsed.notes ?? "").slice(0, 200),
    };
  } catch {
    logger.forRoute("POST /api/treatments/[id]/consent/upload").warn("Could not parse Claude consent verification response", { responseText: text });
    return { legible: true, hasSignature: false, notes: "AI could not parse document — please review manually" };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`upload:${session.userId}`, UPLOAD_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("POST /api/treatments/[id]/consent/upload", session);

  const { id } = await params;
  const db = getDb();

  const [treatment] = await db
    .select({ id: treatments.id, patientId: treatments.patientId })
    .from(treatments)
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));
  if (!treatment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let formData: FormData;
  try { formData = await request.formData(); } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("document") as File | null;
  if (!file) return NextResponse.json({ error: "No document provided" }, { status: 400 });

  const allowedExt = ALLOWED_TYPES[file.type];
  if (!allowedExt) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, or PDF allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be under 5 MB" }, { status: 400 });
  }

  const fileName = `${crypto.randomUUID()}${allowedExt}`;
  const key = `consents/${id}/${fileName}`;
  const bytes = await file.arrayBuffer();

  let documentUrl: string;
  try {
    ({ url: documentUrl } = await storeFile(key, bytes, file.type));
  } catch (err) {
    log.error("Failed to store consent document", err, { treatmentId: id, key });
    return NextResponse.json({ error: "Failed to upload document. Please try again." }, { status: 500 });
  }

  // Run AI verification
  const base64 = Buffer.from(bytes).toString("base64");
  const verify = await verifyWithClaude(base64, file.type);

  const now = Date.now();
  let consentStatus: string;
  if (!verify.legible) {
    consentStatus = "REJECTED";
  } else if (!verify.hasSignature) {
    // Legible but no detected signature — uploaded, needs staff review (not auto-rejected).
    // This also covers PDFs which always return hasSignature=false.
    consentStatus = "UPLOADED";
  } else {
    consentStatus = "VERIFIED";
  }

  try {
    await db
      .update(treatments)
      .set({
        consentStatus,
        consentDocumentUrl: documentUrl,
        consentDocumentName: file.name.replace(/[^\w.\-]/g, "_").slice(0, 255),
        consentUploadedAt: now,
        consentVerifiedAt: consentStatus === "VERIFIED" ? now : null,
        consentNotes: verify.notes,
      })
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));
  } catch (err) {
    log.error("Failed to save consent status after upload", err, { treatmentId: id, consentStatus });
    return NextResponse.json({ error: "Document uploaded but status could not be saved. Contact support." }, { status: 500 });
  }

  log.info("Consent document uploaded", { treatmentId: id, consentStatus, legible: verify.legible, hasSignature: verify.hasSignature });
  return NextResponse.json({
    consentStatus,
    legible: verify.legible,
    hasSignature: verify.hasSignature,
    notes: verify.notes,
  });
}
