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
  };
}

function formatCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    visitsApi.print(id)
      .then((d) => { setData(d as PrintData); setLoading(false); });
  }, [id]);

  if (loading) return <div className="p-10 text-center text-slate-400">Loading...</div>;
  if (!data) return <div className="p-10 text-center text-red-500">Failed to load visit data.</div>;

  const { visit, items, payments, prescriptions, clinic } = data;
  const due = visit.totalAmount - visit.paidAmount;

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

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-lg"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-lg"
        >
          Close
        </button>
      </div>

      <div className="print-container">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div style={{ width: 40, height: 40, background: "#2563eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 24, height: 24 }}>
                <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#1e293b", fontFamily: "sans-serif" }}>{clinic.name}</h1>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", fontFamily: "sans-serif" }}>{formatAddressDisplay(parseAddress(clinic.address))}</p>
          <p style={{ fontSize: 13, color: "#64748b", fontFamily: "sans-serif" }}>
            {clinic.phone && `Phone: ${clinic.phone}`}{clinic.phone && clinic.email && " · "}{clinic.email}
          </p>
        </div>

        <hr style={{ borderColor: "#cbd5e1", marginBottom: 16 }} />

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: "sans-serif", fontWeight: "bold", fontSize: 14, letterSpacing: 2, color: "#374151" }}>
            VISIT RECEIPT / PRESCRIPTION
          </p>
        </div>

        <hr style={{ borderColor: "#cbd5e1", marginBottom: 16 }} />

        {/* Visit Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, fontFamily: "sans-serif", fontSize: 13 }}>
          <div>
            <strong>Visit Code:</strong> {visit.visitCode}
          </div>
          <div>
            <strong>Date:</strong> {formatDate(visit.visitDate)}
          </div>
          <div>
            <strong>Patient:</strong> {visit.patientName} ({visit.patientCode})
          </div>
          <div>
            <strong>Doctor:</strong> {formatDoctorName(visit.doctorName)}
          </div>
          {visit.patientPhone && (
            <div><strong>Phone:</strong> {visit.patientPhone}</div>
          )}
        </div>

        {visit.chiefComplaint && (
          <div style={{ marginBottom: 16, fontFamily: "sans-serif", fontSize: 13 }}>
            <strong>Chief Complaint:</strong> {visit.chiefComplaint}
          </div>
        )}
        {visit.diagnosis && (
          <div style={{ marginBottom: 8, fontFamily: "sans-serif", fontSize: 13 }}>
            <strong>Diagnosis:</strong> {visit.diagnosis}
          </div>
        )}
        {visit.doctorNotes && (
          <div style={{ marginBottom: 16, fontFamily: "sans-serif", fontSize: 13 }}>
            <strong>Doctor Notes:</strong> {visit.doctorNotes}
          </div>
        )}

        {/* Items */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: "sans-serif", fontWeight: "bold", fontSize: 13, marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            PRESCRIPTION / SERVICES
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Item</th>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Category</th>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Tooth</th>
                <th style={{ textAlign: "right", padding: "4px 8px" }}>Qty</th>
                <th style={{ textAlign: "right", padding: "4px 8px" }}>Price</th>
                <th style={{ textAlign: "right", padding: "4px 8px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 12, color: "#94a3b8" }}>No items</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "4px 8px" }}>{item.itemName}</td>
                  <td style={{ padding: "4px 8px" }}>{item.category}</td>
                  <td style={{ padding: "4px 8px" }}>{item.toothNumber || "—"}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: "bold" }}>
                <td colSpan={5} style={{ padding: "6px 8px", textAlign: "right" }}>TOTAL:</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCurrency(visit.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Summary */}
        <div style={{ marginBottom: 20, fontFamily: "sans-serif", fontSize: 13 }}>
          <p style={{ fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            PAYMENT SUMMARY
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Total Amount:</span>
              <span style={{ fontWeight: "bold" }}>{formatCurrency(visit.totalAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Amount Paid:</span>
              <span style={{ fontWeight: "bold", color: "#16a34a" }}>{formatCurrency(visit.paidAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 4 }}>
              <span style={{ fontWeight: "bold" }}>Balance Due:</span>
              <span style={{ fontWeight: "bold", color: due > 0 ? "#dc2626" : "#64748b" }}>{formatCurrency(due)}</span>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div style={{ marginBottom: 24, fontFamily: "sans-serif", fontSize: 13 }}>
            <p style={{ fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
              PAYMENT HISTORY
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "4px 8px" }}>
                      {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "4px 8px", fontWeight: "bold" }}>{formatCurrency(p.amount)}</td>
                    <td style={{ padding: "4px 8px" }}>{p.paymentMethod}</td>
                    <td style={{ padding: "4px 8px", color: "#64748b" }}>{p.referenceNumber || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Prescriptions */}
        {prescriptions.length > 0 && (
          <div style={{ marginBottom: 24, fontFamily: "sans-serif", fontSize: 13 }}>
            <p style={{ fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
              PRESCRIPTION
            </p>
            {prescriptions.map((rx) => {
              let medicines: { name: string; dosage: string; frequency: string; duration: string; notes?: string }[] = [];
              try { medicines = JSON.parse(rx.medicines); } catch { medicines = []; }
              return (
                <div key={rx.id} style={{ marginBottom: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Medicine</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Dosage</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Frequency</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicines.map((m, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "4px 8px", fontWeight: "bold" }}>{m.name}</td>
                          <td style={{ padding: "4px 8px" }}>{m.dosage}</td>
                          <td style={{ padding: "4px 8px" }}>{m.frequency}</td>
                          <td style={{ padding: "4px 8px" }}>{m.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rx.instructions && (
                    <p style={{ marginTop: 6, color: "#475569" }}>
                      <strong>Instructions:</strong> {rx.instructions}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 40, fontFamily: "sans-serif", fontSize: 13 }}>
          <div>
            <div style={{ borderTop: "1px solid #374151", paddingTop: 8, marginTop: 32 }}>
              <p>Doctor Signature</p>
              <p style={{ color: "#64748b" }}>{formatDoctorName(visit.doctorName)}</p>
            </div>
          </div>
          <div>
            <div style={{ borderTop: "1px solid #374151", paddingTop: 8, marginTop: 32 }}>
              <p>Patient Signature</p>
              <p style={{ color: "#64748b" }}>{visit.patientName}</p>
            </div>
          </div>
        </div>

        <hr style={{ borderColor: "#e2e8f0", marginTop: 32, marginBottom: 16 }} />
        <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", fontFamily: "sans-serif" }}>
          <p>Thank you for choosing {clinic.name}</p>
          <p>This is a computer-generated document</p>
        </div>
      </div>
    </>
  );
}
