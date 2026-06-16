/**
 * lib/pdf.ts
 *
 * Shared helpers for building Parkkal PDF documents with pdf-lib.
 * pdf-lib is pure JS and runs in Cloudflare Workers, Node, and browsers.
 *
 * Coordinate system: pdf-lib uses bottom-left origin (0,0).
 * All y values passed to drawText are distances from the BOTTOM of the page.
 * A4 dimensions: 595 x 842 pts.
 */

import { PDFDocument, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { getFile } from "@/lib/storage";

export const A4 = { width: 595, height: 842 };

// Brand colours
export const COLOR = {
  primary:  rgb(0.13, 0.35, 0.82), // blue-700
  dark:     rgb(0.11, 0.11, 0.16), // slate-900
  mid:      rgb(0.35, 0.42, 0.52), // slate-500
  light:    rgb(0.55, 0.62, 0.72), // slate-400
  rule:     rgb(0.88, 0.91, 0.94), // slate-200
  bg:       rgb(0.97, 0.98, 0.99), // slate-50
  success:  rgb(0.06, 0.6,  0.28), // green-600
  warning:  rgb(0.77, 0.49, 0.07), // amber-600
  danger:   rgb(0.80, 0.15, 0.15), // red-600
};

export interface PdfFonts {
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold:    Awaited<ReturnType<PDFDocument["embedFont"]>>;
}

export async function createDoc(): Promise<{ doc: PDFDocument; fonts: PdfFonts }> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, fonts: { regular, bold } };
}

/** Draws a full-width horizontal rule at y (bottom-left coords). */
export function hRule(page: PDFPage, y: number, margin = 40) {
  page.drawLine({
    start: { x: margin, y },
    end:   { x: A4.width - margin, y },
    thickness: 0.5,
    color: COLOR.rule,
  });
}

/** Draws a thin coloured accent bar across the top of the page. */
export function headerBar(page: PDFPage) {
  page.drawRectangle({
    x: 0, y: A4.height - 6,
    width: A4.width, height: 6,
    color: COLOR.primary,
  });
}

/** Two-column label + value row. Returns new y. */
export function labelValue(
  page: PDFPage,
  fonts: PdfFonts,
  label: string,
  value: string,
  x: number,
  y: number,
  opts?: { valueColor?: ReturnType<typeof rgb>; size?: number },
) {
  const size = opts?.size ?? 9;
  page.drawText(label, { x, y, size, font: fonts.regular, color: COLOR.light });
  page.drawText(value, { x: x + 110, y, size, font: fonts.regular, color: opts?.valueColor ?? COLOR.dark });
  return y - (size + 5);
}

/** Right-aligned text helper. */
export function drawRight(
  page: PDFPage,
  font: PdfFonts["regular"],
  text: string,
  y: number,
  size = 9,
  color = COLOR.dark,
  margin = 40,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: A4.width - margin - w, y, size, font, color });
}

/** Draws a table with a shaded header row and alternating row colours. Returns y after the table. */
export function drawTable(
  page: PDFPage,
  fonts: PdfFonts,
  y: number,
  columns: { label: string; width: number; align?: "left" | "right" }[],
  rows: string[][],
  margin = 40,
): number {
  const rowH = 20;
  const totalW = columns.reduce((s, c) => s + c.width, 0);

  // Header background
  page.drawRectangle({ x: margin, y: y - rowH + 4, width: totalW, height: rowH, color: COLOR.bg });
  page.drawLine({ start: { x: margin, y: y - rowH + 4 }, end: { x: margin + totalW, y: y - rowH + 4 }, thickness: 0.5, color: COLOR.rule });

  let cx = margin;
  for (const col of columns) {
    const lw = fonts.bold.widthOfTextAtSize(col.label, 8);
    const lx = col.align === "right" ? cx + col.width - lw - 4 : cx + 4;
    page.drawText(col.label, { x: lx, y: y - 11, size: 8, font: fonts.bold, color: COLOR.mid });
    cx += col.width;
  }
  y -= rowH;

  for (let ri = 0; ri < rows.length; ri++) {
    // Alternating row shading
    if (ri % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - rowH + 4, width: totalW, height: rowH, color: rgb(0.99, 0.99, 1) });
    }
    cx = margin;
    for (let ci = 0; ci < columns.length; ci++) {
      const cell = rows[ri][ci] ?? "";
      const col  = columns[ci];
      const cw   = fonts.regular.widthOfTextAtSize(cell, 9);
      const tx   = col.align === "right" ? cx + col.width - cw - 4 : cx + 4;
      page.drawText(cell, { x: tx, y: y - 12, size: 9, font: fonts.regular, color: COLOR.dark });
      cx += col.width;
    }
    y -= rowH;

    // Row bottom rule
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: margin + totalW, y: y + 4 }, thickness: 0.3, color: COLOR.rule });
  }

  return y;
}

/** Loads the org logo from storage and embeds it into the PDF. Returns null if there's
 *  no logo, the file is missing, or the format is unsupported (pdf-lib embeds PNG/JPEG only —
 *  WebP logos fall back to text-only headers). */
export async function embedOrgLogo(doc: PDFDocument, logoUrl: string | null): Promise<PDFImage | null> {
  if (!logoUrl) return null;
  const key = logoUrl.replace(/^\/api\/files\//, "");
  const file = await getFile(key);
  if (!file) return null;

  try {
    if (file.mimeType === "image/png") return await doc.embedPng(file.data);
    if (file.mimeType === "image/jpeg") return await doc.embedJpg(file.data);
  } catch {
    return null;
  }
  return null;
}

export function rupee(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
