import { eq, and } from "drizzle-orm";
import { treatments, patients, organizations, users } from "@/db/schema";
import { withRoute, apiError } from "@/lib/api";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { createDoc, headerBar, hRule, A4, COLOR } from "@/lib/pdf";

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/treatments/[id]/consent-pdf", permission: PERMISSIONS.VISITS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [row] = await db
      .select({
        id: treatments.id,
        description: treatments.description,
        procedure: treatments.procedure,
        toothNumbers: treatments.toothNumbers,
        cost: treatments.cost,
        status: treatments.status,
        createdAt: treatments.createdAt,
        patientName: patients.name,
        patientDob: patients.dateOfBirth,
        doctorName: users.name,
        orgName: organizations.name,
        orgAddress: organizations.address,
        orgPhone: organizations.phone,
        orgEmail: organizations.email,
      })
      .from(treatments)
      .leftJoin(patients, eq(treatments.patientId, patients.id))
      .leftJoin(users, eq(treatments.doctorId, users.id))
      .leftJoin(organizations, eq(treatments.organizationId, organizations.id))
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

    if (!row) return apiError("Treatment not found", 404);

    // ── Build PDF ──────────────────────────────────────────────────────────────
    const { doc, fonts } = await createDoc();
    const page = doc.addPage([A4.width, A4.height]);

    const M  = 50;
    let y    = A4.height - 30;

    headerBar(page);

    // ── Org header ─────────────────────────────────────────────────────────────
    page.drawText(row.orgName ?? "Dental Clinic", {
      x: M, y, size: 16, font: fonts.bold, color: COLOR.primary,
    });
    y -= 17;

    const orgContact = [row.orgAddress, row.orgPhone, row.orgEmail].filter(Boolean).join("  |  ");
    if (orgContact) {
      page.drawText(orgContact, { x: M, y, size: 8, font: fonts.regular, color: COLOR.mid, maxWidth: A4.width - M * 2 });
      y -= 13;
    }

    y -= 8;
    hRule(page, y, M);
    y -= 22;

    // ── Title ──────────────────────────────────────────────────────────────────
    const title = "TREATMENT CONSENT FORM";
    const titleW = fonts.bold.widthOfTextAtSize(title, 14);
    page.drawText(title, {
      x: (A4.width - titleW) / 2, y,
      size: 14, font: fonts.bold, color: COLOR.dark,
    });
    y -= 30;

    // ── Patient details ────────────────────────────────────────────────────────
    const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const dobStr  = row.patientDob ? new Date(row.patientDob).toLocaleDateString("en-IN") : "—";

    const col2X = (A4.width + M) / 2;

    page.drawText("PATIENT DETAILS", { x: M, y, size: 8, font: fonts.bold, color: COLOR.light });
    y -= 14;

    page.drawText("Full Name:", { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
    page.drawText(row.patientName ?? "—", { x: M + 80, y, size: 9, font: fonts.bold, color: COLOR.dark });

    page.drawText("Date:", { x: col2X, y, size: 9, font: fonts.regular, color: COLOR.mid });
    page.drawText(dateStr, { x: col2X + 50, y, size: 9, font: fonts.regular, color: COLOR.dark });
    y -= 14;

    page.drawText("Date of Birth:", { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
    page.drawText(dobStr, { x: M + 80, y, size: 9, font: fonts.regular, color: COLOR.dark });
    y -= 20;

    hRule(page, y, M);
    y -= 20;

    // ── Proposed treatment ─────────────────────────────────────────────────────
    page.drawText("PROPOSED TREATMENT", { x: M, y, size: 8, font: fonts.bold, color: COLOR.light });
    y -= 16;

    page.drawText(row.description, { x: M, y, size: 11, font: fonts.bold, color: COLOR.dark, maxWidth: A4.width - M * 2 });
    y -= 18;

    if (row.procedure) {
      page.drawText("Procedure:", { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
      page.drawText(row.procedure, { x: M + 80, y, size: 9, font: fonts.regular, color: COLOR.dark });
      y -= 13;
    }

    if (row.toothNumbers) {
      page.drawText("Tooth Numbers:", { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
      page.drawText(row.toothNumbers, { x: M + 95, y, size: 9, font: fonts.regular, color: COLOR.dark });
      y -= 13;
    }

    page.drawText("Estimated Cost:", { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
    page.drawText(
      `Rs. ${row.cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      { x: M + 95, y, size: 9, font: fonts.bold, color: COLOR.primary },
    );
    y -= 22;

    hRule(page, y, M);
    y -= 20;

    // ── Consent statement ──────────────────────────────────────────────────────
    page.drawText("CONSENT STATEMENT", { x: M, y, size: 8, font: fonts.bold, color: COLOR.light });
    y -= 16;

    const consentText = [
      "I, the undersigned patient/guardian, hereby consent to the proposed dental treatment",
      "described above. I understand the nature of the procedure, the associated risks, and",
      "authorize the dental team at " + (row.orgName ?? "this clinic") + " to proceed.",
      "",
      "I acknowledge that I have been informed about alternative treatment options and",
      "potential complications, and that no guarantee has been made regarding the outcome.",
      "",
      "I confirm that I have had the opportunity to ask questions and that all my questions",
      "have been answered to my satisfaction.",
    ];

    for (const line of consentText) {
      if (line === "") { y -= 6; continue; }
      page.drawText(line, { x: M, y, size: 9, font: fonts.regular, color: COLOR.dark, maxWidth: A4.width - M * 2 });
      y -= 13;
    }

    y -= 20;
    hRule(page, y, M);
    y -= 28;

    // ── Signature section ──────────────────────────────────────────────────────
    // Patient signature
    page.drawLine({ start: { x: M, y }, end: { x: M + 200, y }, thickness: 0.8, color: COLOR.mid });
    y -= 12;
    page.drawText("Patient / Guardian Signature", { x: M, y, size: 8, font: fonts.regular, color: COLOR.light });
    page.drawText("Date: ____________________", { x: M + 220, y: y + 12, size: 9, font: fonts.regular, color: COLOR.mid });

    y -= 30;

    // Doctor section
    page.drawText(`Treating Doctor: Dr. ${row.doctorName ?? "—"}`, {
      x: M, y, size: 9, font: fonts.regular, color: COLOR.mid,
    });
    y -= 22;

    // Official use box
    page.drawRectangle({
      x: M, y: y - 40, width: A4.width - M * 2, height: 55,
      borderColor: COLOR.rule, borderWidth: 0.5,
    });
    page.drawText("FOR OFFICIAL USE", { x: M + 8, y: y + 8, size: 7, font: fonts.bold, color: COLOR.light });
    y -= 10;
    page.drawText("Consent Verified By:", { x: M + 8, y, size: 9, font: fonts.regular, color: COLOR.mid });
    page.drawLine({ start: { x: M + 120, y: y - 2 }, end: { x: M + 310, y: y - 2 }, thickness: 0.5, color: COLOR.rule });
    page.drawText("Date:", { x: M + 320, y, size: 9, font: fonts.regular, color: COLOR.mid });
    page.drawLine({ start: { x: M + 345, y: y - 2 }, end: { x: A4.width - M - 8, y: y - 2 }, thickness: 0.5, color: COLOR.rule });

    // ── Footer ─────────────────────────────────────────────────────────────────
    page.drawText("This form is valid only with the patient's original signature.", {
      x: M, y: 20, size: 7, font: fonts.regular, color: COLOR.light,
    });

    const pdfBytes = await doc.save();
    const filename = `consent-${(row.patientName ?? "patient").replace(/\s+/g, "-").toLowerCase()}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
);
