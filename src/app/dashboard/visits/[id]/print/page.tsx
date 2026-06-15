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

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-container { padding: 20px; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
        .print-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; }
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
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              {clinic.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinic.logoUrl} alt={clinic.name} style={{ height: 40, width: "auto", objectFit: "contain" }} />
              ) : (
                <div style={{ width: 36, height: 36, background: "#0B6E6E", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="white" style={{ width: 20, height: 20 }}>
                    <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
                  </svg>
                </div>
              )}
              <span style={{ fontSize: 20, fontWeight: "bold", color: "#1C1A15" }}>{clinic.name}</span>
            </div>
            <p style={{ fontSize: 12, color: "#645D50", margin: "2px 0" }}>{formatAddressDisplay(parseAddress(clinic.address))}</p>
            <p style={{ fontSize: 12, color: "#645D50", margin: "2px 0" }}>
              {clinic.phone && `Tel: ${clinic.phone}`}
              {clinic.phone && clinic.email && " · "}
              {clinic.email}
            </p>
            {clinic.gstRegistered && clinic.gstin && (
              <p style={{ fontSize: 12, color: "#374151", margin: "4px 0", fontWeight: 600 }}>
                GSTIN: {clinic.gstin}
                {clinic.gstStateCode && ` · State Code: ${clinic.gstStateCode}`}
              </p>
            )}
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 13, fontWeight: "bold", letterSpacing: 1.5, color: "#374151", margin: 0 }}>
              {clinic.gstRegistered ? "TAX INVOICE" : "VISIT RECEIPT"}
            </p>
            <p style={{ fontSize: 12, color: "#645D50", margin: "4px 0 0" }}>#{visit.visitCode}</p>
            <p style={{ fontSize: 12, color: "#645D50", margin: "2px 0 0" }}>{formatDate(visit.visitDate)}</p>
          </div>
        </div>

        <hr style={{ borderColor: "#E5E0D8", marginBottom: 16 }} />

        {/* ── Patient / Doctor info ───────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, fontSize: 13 }}>
          <div><strong>Patient:</strong> {visit.patientName} ({visit.patientCode})</div>
          <div><strong>Doctor:</strong> {formatDoctorName(visit.doctorName)}</div>
          {visit.patientPhone && <div><strong>Phone:</strong> {visit.patientPhone}</div>}
          <div><strong>Date:</strong> {formatDate(visit.visitDate)}</div>
        </div>

        {visit.chiefComplaint && (
          <div style={{ marginBottom: 10, fontSize: 13 }}><strong>Chief Complaint:</strong> {visit.chiefComplaint}</div>
        )}
        {visit.diagnosis && (
          <div style={{ marginBottom: 10, fontSize: 13 }}><strong>Diagnosis:</strong> {visit.diagnosis}</div>
        )}
        {visit.doctorNotes && (
          <div style={{ marginBottom: 16, fontSize: 13 }}><strong>Doctor Notes:</strong> {visit.doctorNotes}</div>
        )}

        {/* ── Services / Items ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: "bold", fontSize: 13, marginBottom: 8, borderBottom: "1px solid #E5E0D8", paddingBottom: 4 }}>
            SERVICES RENDERED
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E5E0D8" }}>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Description</th>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Category</th>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Tooth</th>
                <th style={{ textAlign: "right", padding: "4px 8px" }}>Qty</th>
                <th style={{ textAlign: "right", padding: "4px 8px" }}>Rate</th>
                <th style={{ textAlign: "right", padding: "4px 8px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 12, color: "#B0A99B" }}>No items</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #EFEBE2" }}>
                  <td style={{ padding: "5px 8px" }}>{item.itemName}</td>
                  <td style={{ padding: "5px 8px" }}>{item.category}</td>
                  <td style={{ padding: "5px 8px" }}>{item.toothNumber || "—"}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Billing summary ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: "bold", fontSize: 13, marginBottom: 8, borderBottom: "1px solid #E5E0D8", paddingBottom: 4 }}>
            BILLING SUMMARY
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, maxWidth: 320, marginLeft: "auto" }}>
            {gst ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#645D50" }}>Taxable amount:</span>
                  <span>{formatCurrency(gst.taxable)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#645D50" }}>CGST @ {clinic.cgstRate}%:</span>
                  <span>{formatCurrency(gst.cgstAmt)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#645D50" }}>SGST @ {clinic.sgstRate}%:</span>
                  <span>{formatCurrency(gst.sgstAmt)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #E5E0D8", paddingTop: 5, fontWeight: "bold" }}>
                  <span>Total (incl. GST):</span>
                  <span>{formatCurrency(visit.totalAmount)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                <span>Total:</span>
                <span>{formatCurrency(visit.totalAmount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#1E6E4B" }}>Amount paid:</span>
              <span style={{ color: "#1E6E4B", fontWeight: "bold" }}>{formatCurrency(visit.paidAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #E5E0D8", paddingTop: 5, fontWeight: "bold" }}>
              <span>Balance due:</span>
              <span style={{ color: due > 0 ? "#A8311F" : "#645D50" }}>{formatCurrency(due)}</span>
            </div>
          </div>
        </div>

        {/* ── Payment history ─────────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <div style={{ marginBottom: 24, fontSize: 13 }}>
            <p style={{ fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #E5E0D8", paddingBottom: 4 }}>
              PAYMENT HISTORY
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #EFEBE2" }}>
                    <td style={{ padding: "4px 8px" }}>
                      {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "4px 8px", fontWeight: "bold" }}>{formatCurrency(p.amount)}</td>
                    <td style={{ padding: "4px 8px" }}>{p.paymentMethod}</td>
                    <td style={{ padding: "4px 8px", color: "#645D50" }}>{p.referenceNumber || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Prescriptions ───────────────────────────────────────────────────── */}
        {prescriptions.length > 0 && (
          <div style={{ marginBottom: 24, fontSize: 13 }}>
            <p style={{ fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #E5E0D8", paddingBottom: 4 }}>
              PRESCRIPTION
            </p>
            {prescriptions.map((rx) => {
              let medicines: { name: string; dosage: string; frequency: string; duration: string; notes?: string }[] = [];
              try { medicines = JSON.parse(rx.medicines); } catch { medicines = []; }
              return (
                <div key={rx.id} style={{ marginBottom: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #E5E0D8" }}>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Medicine</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Dosage</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Frequency</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicines.map((m, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #EFEBE2" }}>
                          <td style={{ padding: "4px 8px", fontWeight: "bold" }}>{m.name}</td>
                          <td style={{ padding: "4px 8px" }}>{m.dosage}</td>
                          <td style={{ padding: "4px 8px" }}>{m.frequency}</td>
                          <td style={{ padding: "4px 8px" }}>{m.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rx.instructions && (
                    <p style={{ marginTop: 6, color: "#645D50" }}><strong>Instructions:</strong> {rx.instructions}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Signatures ──────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 40, fontSize: 13 }}>
          <div>
            <div style={{ borderTop: "1px solid #374151", paddingTop: 8, marginTop: 32 }}>
              <p style={{ margin: 0 }}>Doctor Signature</p>
              <p style={{ color: "#645D50", margin: "4px 0 0" }}>{formatDoctorName(visit.doctorName)}</p>
            </div>
          </div>
          <div>
            <div style={{ borderTop: "1px solid #374151", paddingTop: 8, marginTop: 32 }}>
              <p style={{ margin: 0 }}>Patient Signature</p>
              <p style={{ color: "#645D50", margin: "4px 0 0" }}>{visit.patientName}</p>
            </div>
          </div>
        </div>

        <hr style={{ borderColor: "#E5E0D8", marginTop: 32, marginBottom: 16 }} />
        <div style={{ textAlign: "center", fontSize: 12, color: "#B0A99B" }}>
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
