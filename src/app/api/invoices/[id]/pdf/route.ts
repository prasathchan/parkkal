import { eq, and } from "drizzle-orm";
import { invoices, invoiceTreatments, treatments, patients, organizations } from "@/db/schema";
import { withRoute, apiError } from "@/lib/api";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createDoc, headerBar, hRule, drawTable, drawRight, rupee, embedOrgLogo,
  A4, COLOR,
} from "@/lib/pdf";

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/invoices/[id]/pdf", permission: PERMISSIONS.VISITS_VIEW },
  async (_req, { session, db }, { id }) => {
    // ── Fetch invoice + patient ────────────────────────────────────────────────
    const [row] = await db
      .select({
        id: invoices.id,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        patientName: patients.name,
        patientPhone: patients.phone,
        orgName: organizations.name,
        orgAddress: organizations.address,
        orgPhone: organizations.phone,
        orgEmail: organizations.email,
        orgLogoUrl: organizations.logoUrl,
        orgGstin: organizations.gstin,
        cgstRate: organizations.cgstRate,
        sgstRate: organizations.sgstRate,
        gstRegistered: organizations.gstRegistered,
      })
      .from(invoices)
      .leftJoin(patients, eq(invoices.patientId, patients.id))
      .leftJoin(organizations, eq(invoices.organizationId, organizations.id))
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));

    if (!row) return apiError("Invoice not found", 404);

    // ── Fetch line items ───────────────────────────────────────────────────────
    const lineItems = await db
      .select({ description: treatments.description, cost: treatments.cost, procedure: treatments.procedure })
      .from(invoiceTreatments)
      .innerJoin(treatments, eq(invoiceTreatments.treatmentId, treatments.id))
      .where(eq(invoiceTreatments.invoiceId, id));

    // ── Build PDF ──────────────────────────────────────────────────────────────
    const { doc, fonts } = await createDoc();
    const page = doc.addPage([A4.width, A4.height]);

    const M = 40; // margin
    let y = A4.height - 30;

    // Top accent bar
    headerBar(page);

    // ── Org header ─────────────────────────────────────────────────────────────
    const logoImg = await embedOrgLogo(doc, row.orgLogoUrl);
    let nameX = M;
    if (logoImg) {
      const logoH = 26;
      const logoW = (logoImg.width / logoImg.height) * logoH;
      page.drawImage(logoImg, { x: M, y: y - logoH + 4, width: logoW, height: logoH });
      nameX = M + logoW + 10;
    }

    page.drawText(row.orgName ?? "Dental Clinic", {
      x: nameX, y, size: 18, font: fonts.bold, color: COLOR.primary,
    });
    y -= 20;

    if (row.orgAddress) {
      page.drawText(row.orgAddress, { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
      y -= 13;
    }
    const orgContact = [row.orgPhone, row.orgEmail].filter(Boolean).join("  |  ");
    if (orgContact) {
      page.drawText(orgContact, { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
      y -= 13;
    }
    if (row.gstRegistered && row.orgGstin) {
      page.drawText(`GSTIN: ${row.orgGstin}`, { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
      y -= 13;
    }

    y -= 6;
    hRule(page, y, M);
    y -= 18;

    // ── Invoice title + meta ───────────────────────────────────────────────────
    page.drawText("TAX INVOICE", { x: M, y, size: 14, font: fonts.bold, color: COLOR.dark });

    const invoiceNum = `INV-${row.id.slice(0, 8).toUpperCase()}`;
    const dateStr    = new Date(row.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    drawRight(page, fonts.bold,    invoiceNum, y,      10, COLOR.dark, M);
    drawRight(page, fonts.regular, dateStr,    y - 14, 9,  COLOR.mid,  M);

    y -= 16;

    const statusColor =
      row.status === "PAID"    ? COLOR.success :
      row.status === "PARTIAL" ? COLOR.warning  : COLOR.danger;
    const statusLabel = row.status === "PAID" ? "PAID" : row.status === "PARTIAL" ? "PARTIAL PAYMENT" : "PAYMENT PENDING";
    drawRight(page, fonts.bold, statusLabel, y, 9, statusColor, M);

    y -= 20;
    hRule(page, y, M);
    y -= 18;

    // ── Bill To ────────────────────────────────────────────────────────────────
    page.drawText("BILL TO", { x: M, y, size: 8, font: fonts.bold, color: COLOR.light });
    y -= 14;
    page.drawText(row.patientName ?? "Patient", { x: M, y, size: 11, font: fonts.bold, color: COLOR.dark });
    y -= 13;
    if (row.patientPhone) {
      page.drawText(row.patientPhone, { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid });
      y -= 13;
    }

    y -= 14;
    hRule(page, y, M);
    y -= 20;

    // ── Line items table ───────────────────────────────────────────────────────
    const tableRows = lineItems.length > 0
      ? lineItems.map((item: { description: string; cost: number; procedure: string | null }, i: number) => [
          String(i + 1),
          item.description + (item.procedure ? ` (${item.procedure})` : ""),
          rupee(item.cost),
        ])
      : [["1", "General Dental Services", rupee(row.totalAmount)]];

    const columns = [
      { label: "#",           width: 28,  align: "left"  as const },
      { label: "DESCRIPTION", width: 362, align: "left"  as const },
      { label: "AMOUNT",      width: 85,  align: "right" as const },
    ];

    y = drawTable(page, fonts, y, columns, tableRows, M);
    y -= 10;
    hRule(page, y, M);
    y -= 18;

    // ── Totals ─────────────────────────────────────────────────────────────────
    const subtotal = lineItems.reduce((s: number, l: { cost: number }) => s + l.cost, 0) || row.totalAmount;
    const due      = row.totalAmount - row.paidAmount;

    const totalsX = A4.width - M - 200;

    const totalRow = (label: string, value: string, bold = false, color = COLOR.dark) => {
      page.drawText(label, { x: totalsX, y, size: 9, font: bold ? fonts.bold : fonts.regular, color: COLOR.mid });
      drawRight(page, bold ? fonts.bold : fonts.regular, value, y, 9, color, M);
      y -= 14;
    };

    if (lineItems.length > 0) {
      totalRow("Subtotal", rupee(subtotal));
    }
    if (row.gstRegistered) {
      const cgst = subtotal * (row.cgstRate / 100);
      const sgst = subtotal * (row.sgstRate / 100);
      totalRow(`CGST @ ${row.cgstRate}%`, rupee(cgst));
      totalRow(`SGST @ ${row.sgstRate}%`, rupee(sgst));
    }
    totalRow("Total", rupee(row.totalAmount), true);
    y -= 4;
    hRule(page, y, totalsX);
    y -= 14;
    totalRow("Amount Paid", rupee(row.paidAmount), false, COLOR.success);
    totalRow("Amount Due",  rupee(due),             true,  due > 0 ? COLOR.danger : COLOR.success);

    // ── Notes ──────────────────────────────────────────────────────────────────
    if (row.notes) {
      y -= 20;
      hRule(page, y + 16, M);
      y -= 4;
      page.drawText("Notes", { x: M, y, size: 8, font: fonts.bold, color: COLOR.light });
      y -= 13;
      page.drawText(row.notes, { x: M, y, size: 9, font: fonts.regular, color: COLOR.mid, maxWidth: 400 });
      y -= 13;
    }

    // ── Footer ─────────────────────────────────────────────────────────────────
    page.drawText(`Thank you for choosing ${row.orgName ?? "us"}.`, {
      x: M, y: 30, size: 8, font: fonts.regular, color: COLOR.light,
    });
    page.drawText("This is a computer-generated invoice.", {
      x: M, y: 20, size: 7, font: fonts.regular, color: COLOR.light,
    });

    const pdfBytes = await doc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceNum}.pdf"`,
      },
    });
  }
);
