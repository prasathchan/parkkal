"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatDoctorName } from "@/lib/utils";
import { parseAddress, formatAddressDisplay } from "@/lib/address";
import { visitsApi } from "@/api";

interface PrintData {
  visit: {
    visitCode: string;
    visitDate: string;
    chiefComplaint?: string | null;
    doctorNotes?: string | null;
    diagnosis?: string | null;
    totalAmount: number;
    paidAmount: number;
    patientName: string;
    patientCode: string;
    patientPhone?: string;
    doctorName: string;
  };
  items: {
    id: string;
    itemName: string;
    category: string;
    toothNumber?: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: string;
    paidAt: number;
    referenceNumber?: string | null;
  }[];
  prescriptions: {
    id: string;
    medicines: string;
    instructions?: string | null;
    createdAt: number;
  }[];
  clinic: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl: string | null;
    gstin: string | null;
    gstRegistered: boolean;
    gstStateCode: string | null;
    cgstRate: number;
    sgstRate: number;
  };
}

// Shared neutral/brand colours — kept as literals (not CSS vars) so the printed
// page renders identically regardless of the viewer's light/dark theme.
const INK        = "#1C1A15"; // pk-neutral-900
const MUTED      = "#645D50"; // pk-neutral-600 — passes WCAG AA on white (~5.9:1)
const RULE       = "#E5E0D8"; // pk-neutral-200
const RULE_LIGHT = "#EFEBE2"; // pk-neutral-150
const TEAL       = "#0B6E6E";
const SUCCESS    = "#1E6E4B";
const WARNING    = "#9A5B0A";
const DANGER     = "#A8311F";

function formatCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

/** For GST-registered orgs, prices are treated as tax-inclusive.
 *  taxable = total / (1 + (cgst + sgst) / 100)
 *  cgstAmt = taxable * cgstRate / 100
 *  sgstAmt = taxable * sgstRate / 100
 */
function computeGst(total: number, cgstRate: number, sgstRate: number) {
  const combinedRate = cgstRate + sgstRate;
  const taxable = total / (1 + combinedRate / 100);
  const cgstAmt = taxable * cgstRate / 100;
  const sgstAmt = taxable * sgstRate / 100;
  return { taxable, cgstAmt, sgstAmt };
}

function billingStatus(paid: number, total: number): { label: string; color: string; bg: string } {
  if (total > 0 && paid >= total) return { label: "PAID", color: SUCCESS, bg: "#E8F4EE" };
  if (paid > 0) return { label: "PARTIALLY PAID", color: WARNING, bg: "#FBF1E3" };
  return { label: "PAYMENT PENDING", color: DANGER, bg: "#FAEBE8" };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontWeight: 700, fontSize: 13, letterSpacing: 0.4, color: INK,
        marginBottom: 10, borderBottom: `1px solid ${RULE}`, paddingBottom: 6,
      }}
    >
      {children}
    </h2>
  );
}

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    visitsApi.print(id)
      .then((d) => { setData(d as PrintData); setLoading(false); });
  }, [id]);

  if (loading) return <div className="p-10 text-center text-pk-text-muted">Loading...</div>;
  if (!data) return <div className="p-10 text-center text-pk-danger-text">Failed to load visit data.</div>;

  const { visit, items, payments, prescriptions, clinic } = data;
  const due = visit.totalAmount - visit.paidAmount;
  const gst = clinic.gstRegistered ? computeGst(visit.totalAmount, clinic.cgstRate, clinic.sgstRate) : null;
  const status = billingStatus(visit.paidAmount, visit.totalAmount);
  const documentTitle = clinic.gstRegistered ? "TAX INVOICE" : "VISIT RECEIPT";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-container { padding: 20px; }
          .avoid-break { break-inside: avoid; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: ${INK}; }
        .print-container { max-width: 800px; margin: 0 auto; background: white; color: ${INK}; padding: 40px; font-size: 14px; }
        .print-container th { color: ${INK}; }
        .print-container h1, .print-container h2 { font-family: inherit; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="bg-pk-teal-600 text-white px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-teal-700 transition shadow-pk-e2"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-pk-surface border border-pk-border text-pk-text-secondary px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-surface-raised transition shadow-pk-e2"
        >
          Close
        </button>
      </div>

      <div className="print-container">
        {/* ── Masthead ───────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              {clinic.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinic.logoUrl} alt={clinic.name} style={{ height: 40, width: "auto", objectFit: "contain" }} />
              ) : (
                <div style={{ width: 36, height: 36, background: TEAL, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/parkkal-mark-white.svg" alt="" style={{ width: 20, height: 20 }} />
                </div>
              )}
              <h1 style={{ fontSize: 20, fontWeight: 700, color: INK, margin: 0 }}>{clinic.name}</h1>
            </div>
            <p style={{ fontSize: 12, color: MUTED, margin: "2px 0" }}>{formatAddressDisplay(parseAddress(clinic.address))}</p>
            <p style={{ fontSize: 12, color: MUTED, margin: "2px 0" }}>
              {clinic.phone && `Tel: ${clinic.phone}`}
              {clinic.phone && clinic.email && " · "}
              {clinic.email}
            </p>
            {clinic.gstRegistered && clinic.gstin && (
              <p style={{ fontSize: 12, color: INK, margin: "4px 0", fontWeight: 600 }}>
                GSTIN: {clinic.gstin}
                {clinic.gstStateCode && ` · State Code: ${clinic.gstStateCode}`}
              </p>
            )}
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: INK, margin: 0 }}>
              {documentTitle}
            </p>
            <p style={{ fontSize: 12, color: MUTED, margin: "4px 0 0" }}>#{visit.visitCode}</p>
            <p style={{ fontSize: 12, color: MUTED, margin: "2px 0 8px" }}>{formatDate(visit.visitDate)}</p>
            <span
              style={{
                display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                color: status.color, background: status.bg, borderRadius: 4, padding: "3px 10px",
              }}
            >
              {status.label}
            </span>
          </div>
        </div>

        <hr style={{ borderColor: RULE, marginBottom: 20 }} />

        {/* ── Patient / Doctor info card ───────────────────────────────────────── */}
        <div
          className="avoid-break"
          style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            marginBottom: 16, fontSize: 13, background: "#FAF8F3",
            border: `1px solid ${RULE}`, borderRadius: 6, padding: "12px 16px",
          }}
        >
          <div><strong>Patient:</strong> {visit.patientName} ({visit.patientCode})</div>
          <div><strong>Doctor:</strong> {formatDoctorName(visit.doctorName)}</div>
          {visit.patientPhone && <div><strong>Phone:</strong> {visit.patientPhone}</div>}
          <div><strong>Date:</strong> {formatDate(visit.visitDate)}</div>
        </div>

        {(visit.chiefComplaint || visit.diagnosis || visit.doctorNotes) && (
          <div
            className="avoid-break"
            style={{
              marginBottom: 20, fontSize: 13, background: "#FCFBF8",
              border: `1px solid ${RULE_LIGHT}`, borderRadius: 6, padding: "10px 16px",
            }}
          >
            {visit.chiefComplaint && (
              <div style={{ marginBottom: 6 }}><strong>Chief Complaint:</strong> {visit.chiefComplaint}</div>
            )}
            {visit.diagnosis && (
              <div style={{ marginBottom: 6 }}><strong>Diagnosis:</strong> {visit.diagnosis}</div>
            )}
            {visit.doctorNotes && (
              <div><strong>Doctor Notes:</strong> {visit.doctorNotes}</div>
            )}
          </div>
        )}

        {/* ── Services / Items ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Services Rendered</SectionLabel>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${RULE}` }}>
                <th scope="col" style={{ textAlign: "left", padding: "4px 8px" }}>Description</th>
                <th scope="col" style={{ textAlign: "left", padding: "4px 8px" }}>Category</th>
                <th scope="col" style={{ textAlign: "left", padding: "4px 8px" }}>Tooth</th>
                <th scope="col" style={{ textAlign: "right", padding: "4px 8px" }}>Qty</th>
                <th scope="col" style={{ textAlign: "right", padding: "4px 8px" }}>Rate</th>
                <th scope="col" style={{ textAlign: "right", padding: "4px 8px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 12, color: MUTED }}>No items</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="avoid-break" style={{ borderBottom: `1px solid ${RULE_LIGHT}` }}>
                  <td style={{ padding: "6px 8px" }}>{item.itemName}</td>
                  <td style={{ padding: "6px 8px" }}>{item.category}</td>
                  <td style={{ padding: "6px 8px" }}>{item.toothNumber || "—"}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Billing summary ─────────────────────────────────────────────────── */}
        <div className="avoid-break" style={{ marginBottom: 20, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 320, background: "#FAF8F3", border: `1px solid ${RULE}`, borderRadius: 6, padding: "14px 18px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              {gst ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: MUTED }}>Taxable amount:</span>
                    <span>{formatCurrency(gst.taxable)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: MUTED }}>CGST @ {clinic.cgstRate}%:</span>
                    <span>{formatCurrency(gst.cgstAmt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: MUTED }}>SGST @ {clinic.sgstRate}%:</span>
                    <span>{formatCurrency(gst.sgstAmt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${RULE}`, paddingTop: 6, fontWeight: 700 }}>
                    <span>Total (incl. GST):</span>
                    <span>{formatCurrency(visit.totalAmount)}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>Total:</span>
                  <span>{formatCurrency(visit.totalAmount)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: SUCCESS }}>Amount paid:</span>
                <span style={{ color: SUCCESS, fontWeight: 700 }}>{formatCurrency(visit.paidAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${RULE}`, paddingTop: 6, fontWeight: 700, fontSize: 14 }}>
                <span>Balance due:</span>
                <span style={{ color: due > 0 ? DANGER : MUTED }}>{formatCurrency(due)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Payment history ─────────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <div style={{ marginBottom: 24, fontSize: 13 }}>
            <SectionLabel>Payment History</SectionLabel>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${RULE}` }}>
                  <th scope="col" style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: MUTED }}>Date</th>
                  <th scope="col" style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: MUTED }}>Amount</th>
                  <th scope="col" style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: MUTED }}>Method</th>
                  <th scope="col" style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: MUTED }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="avoid-break" style={{ borderBottom: `1px solid ${RULE_LIGHT}` }}>
                    <td style={{ padding: "5px 8px" }}>
                      {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "5px 8px", fontWeight: 700 }}>{formatCurrency(p.amount)}</td>
                    <td style={{ padding: "5px 8px" }}>{p.paymentMethod}</td>
                    <td style={{ padding: "5px 8px", color: MUTED }}>{p.referenceNumber || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Prescriptions ───────────────────────────────────────────────────── */}
        {prescriptions.length > 0 && (
          <div style={{ marginBottom: 24, fontSize: 13 }}>
            <SectionLabel>Prescription</SectionLabel>
            {prescriptions.map((rx) => {
              let medicines: { name: string; dosage: string; frequency: string; duration: string; notes?: string }[] = [];
              try { medicines = JSON.parse(rx.medicines); } catch { medicines = []; }
              return (
                <div key={rx.id} className="avoid-break" style={{ marginBottom: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${RULE}` }}>
                        <th scope="col" style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: MUTED }}>Medicine</th>
                        <th scope="col" style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: MUTED }}>Dosage</th>
                        <th scope="col" style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: MUTED }}>Frequency</th>
                        <th scope="col" style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: MUTED }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicines.map((m, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${RULE_LIGHT}` }}>
                          <td style={{ padding: "5px 8px", fontWeight: 700 }}>{m.name}</td>
                          <td style={{ padding: "5px 8px" }}>{m.dosage}</td>
                          <td style={{ padding: "5px 8px" }}>{m.frequency}</td>
                          <td style={{ padding: "5px 8px" }}>{m.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rx.instructions && (
                    <p style={{ marginTop: 6, color: MUTED }}><strong>Instructions:</strong> {rx.instructions}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Signatures ──────────────────────────────────────────────────────── */}
        <div className="avoid-break" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 40, fontSize: 13 }}>
          <div>
            <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 8, marginTop: 32 }}>
              <p style={{ margin: 0 }}>Doctor Signature</p>
              <p style={{ color: MUTED, margin: "4px 0 0" }}>{formatDoctorName(visit.doctorName)}</p>
            </div>
          </div>
          <div>
            <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 8, marginTop: 32 }}>
              <p style={{ margin: 0 }}>Patient Signature</p>
              <p style={{ color: MUTED, margin: "4px 0 0" }}>{visit.patientName}</p>
            </div>
          </div>
        </div>

        <hr style={{ borderColor: RULE, marginTop: 32, marginBottom: 16 }} />
        <div style={{ textAlign: "center", fontSize: 12, color: MUTED }}>
          <p style={{ margin: "2px 0" }}>Thank you for choosing {clinic.name}</p>
          <p style={{ margin: "2px 0" }}>
            {clinic.gstRegistered
              ? "This is a computer-generated tax invoice"
              : "This is a computer-generated document"}
          </p>
        </div>
      </div>
    </>
  );
}
