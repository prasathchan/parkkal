"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import { ToothChart } from "@/components/ui/tooth-chart";
import { treatmentsApi, ApiError } from "@/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Treatment {
  id: string;
  description: string;
  procedure?: string | null;
  toothNumbers?: string | null;
  cost: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  consentStatus: string;
  consentDocumentUrl?: string | null;
  consentDocumentName?: string | null;
  consentNotes?: string | null;
  emergencyOverride: number;
  emergencyReason?: string | null;
  createdAt: number;
  patientId: string;
  patientName?: string | null;
  patientCode?: string | null;
  doctorId: string;
  doctorName?: string | null;
}

interface VisitRow {
  visitId: string;
  visitCode: string;
  visitDate: string;
  visitStatus: string;
  visitTotalAmount: number;
  visitPaidAmount: number;
  treatmentBilledAmount: number; // amount charged to THIS treatment in this visit
  doctorName: string | null;
}

interface Summary {
  treatmentCost: number;
  totalPaid: number;
  outstanding: number;
  paidPercent: number; // 0–100
  visitCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PLANNED: "bg-yellow-50 text-yellow-800 border-yellow-200",
  IN_PROGRESS: "bg-blue-50 text-blue-800 border-blue-200",
  COMPLETED: "bg-green-50 text-green-800 border-green-200",
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const CONSENT_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  UPLOADED: "bg-blue-50 text-blue-700 border-blue-200",
  VERIFIED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  EMERGENCY_OVERRIDE: "bg-orange-50 text-orange-700 border-orange-200",
};

const CONSENT_LABEL: Record<string, string> = {
  PENDING: "⚠ Consent Pending",
  UPLOADED: "⏳ Awaiting Verification",
  VERIFIED: "✓ Consent Verified",
  REJECTED: "✗ Consent Rejected",
  EMERGENCY_OVERRIDE: "⚡ Emergency Override",
};

const VISIT_STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

/**
 * Returns color classes for the payment progress bar and card background
 * based on the 4-tier thresholds: 0–25% red, 25–50% orange, 50–99% yellow, 100% green.
 */
function getPaymentColors(pct: number): {
  bar: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  label: string;
} {
  if (pct >= 100) return { bar: "bg-green-500",  cardBg: "bg-green-50",  cardBorder: "border-green-200", text: "text-green-700",  label: "text-green-600" };
  if (pct >= 50)  return { bar: "bg-yellow-400", cardBg: "bg-yellow-50", cardBorder: "border-yellow-200", text: "text-yellow-700", label: "text-yellow-600" };
  if (pct >= 25)  return { bar: "bg-orange-400", cardBg: "bg-orange-50", cardBorder: "border-orange-200", text: "text-orange-700", label: "text-orange-600" };
  return             { bar: "bg-red-500",    cardBg: "bg-red-50",    cardBorder: "border-red-200",    text: "text-red-700",    label: "text-red-600" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreatmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await treatmentsApi.getVisits(id);
        setTreatment(data.treatment);
        setVisits(data.visits);
        setSummary(data.summary);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        setError(e instanceof ApiError ? e.message : (status === 404 ? "Treatment plan not found." : "Network error. Please try again."));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const toothList = treatment?.toothNumbers
    ? treatment.toothNumbers.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const payColors = summary ? getPaymentColors(summary.paidPercent) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title={treatment?.description ?? "Treatment Plan"} />
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <nav className="text-sm text-slate-500 flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-slate-700">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/treatments" className="hover:text-slate-700">Treatment Plans</Link>
          <span>/</span>
          <span className="text-slate-900 font-medium truncate max-w-xs">
            {loading ? "Loading…" : (treatment?.description ?? "Treatment Plan")}
          </span>
        </nav>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
            Loading treatment details…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 text-sm">
            {error}
          </div>
        )}

        {!loading && treatment && summary && payColors && (
          <>
            {/* ── Header card ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-xl font-bold text-slate-900">{treatment.description}</h1>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[treatment.status] ?? STATUS_BADGE.PLANNED}`}>
                      {STATUS_LABEL[treatment.status] ?? treatment.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap mt-1">
                    <Link
                      href={`/dashboard/patients/${treatment.patientId}`}
                      className="hover:text-blue-600 font-medium text-slate-700"
                    >
                      {treatment.patientName ?? "Unknown Patient"}
                      {treatment.patientCode && (
                        <span className="ml-1 text-slate-400 font-normal">({treatment.patientCode})</span>
                      )}
                    </Link>
                    {treatment.doctorName && <span>Dr. {treatment.doctorName}</span>}
                    <span>{new Date(treatment.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Treatment details */}
              {(treatment.procedure || toothList.length > 0) && (
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {treatment.procedure && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Procedure Notes</p>
                      <p className="text-sm text-slate-700">{treatment.procedure}</p>
                    </div>
                  )}
                  {toothList.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Tooth Selection</p>
                      <ToothChart value={toothList} readOnly compact />
                    </div>
                  )}
                </div>
              )}

              {/* Consent row */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${CONSENT_BADGE[treatment.consentStatus] ?? CONSENT_BADGE.PENDING}`}>
                  {CONSENT_LABEL[treatment.consentStatus] ?? treatment.consentStatus}
                </span>
                {treatment.consentNotes && (
                  <span className="text-xs text-slate-400 italic">{treatment.consentNotes}</span>
                )}
                {treatment.emergencyReason && (
                  <span className="text-xs text-orange-600">Reason: {treatment.emergencyReason}</span>
                )}
                {treatment.consentDocumentUrl && (
                  <a
                    href={treatment.consentDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View Consent Document ↗
                  </a>
                )}
                <a
                  href={`/api/treatments/${treatment.id}/consent-pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition ml-auto"
                >
                  Download Consent Form PDF
                </a>
              </div>
            </div>

            {/* ── Financial summary ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Box 1 — Treatment Cost (neutral) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                <p className="text-xs text-slate-500 mb-1.5">Treatment Cost</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.treatmentCost)}</p>
              </div>

              {/* Box 2 — Total Paid (colored + progress bar) */}
              <div className={`rounded-xl border p-5 ${payColors.cardBg} ${payColors.cardBorder}`}>
                <p className={`text-xs font-medium mb-1.5 ${payColors.label}`}>Total Paid</p>
                <p className={`text-2xl font-bold mb-2 ${payColors.text}`}>
                  {formatCurrency(summary.totalPaid)}
                </p>
                {/* Progress bar */}
                <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${payColors.bar}`}
                    style={{ width: `${summary.paidPercent}%` }}
                  />
                </div>
                <p className={`text-xs mt-1.5 font-semibold ${payColors.label}`}>
                  {summary.paidPercent}% of treatment cost
                </p>
              </div>

              {/* Box 3 — Balance */}
              {summary.outstanding > 0 ? (
                <div className="bg-red-50 rounded-xl border border-red-200 p-5 text-center">
                  <p className="text-xs text-red-500 mb-1.5">Outstanding</p>
                  <p className="text-2xl font-bold text-red-700">{formatCurrency(summary.outstanding)}</p>
                  <p className="text-xs text-red-400 mt-1.5">Not yet charged</p>
                </div>
              ) : (
                <div className="bg-green-50 rounded-xl border border-green-200 p-5 text-center flex flex-col items-center justify-center">
                  <span className="text-2xl mb-1">✓</span>
                  <p className="text-sm font-semibold text-green-700">Fully Settled</p>
                  <p className="text-xs text-green-500 mt-0.5">No balance remaining</p>
                </div>
              )}
            </div>

            {/* ── Visit History ── */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">
                  Visit History
                  <span className="ml-2 text-slate-400 font-normal">
                    ({summary.visitCount} {summary.visitCount === 1 ? "visit" : "visits"})
                  </span>
                </h2>
              </div>

              {visits.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-400">
                  This treatment plan has not been linked to any visit yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Visit</th>
                      <th className="px-5 py-3 text-left font-medium">Date</th>
                      <th className="px-5 py-3 text-left font-medium">Doctor</th>
                      <th className="px-5 py-3 text-left font-medium">Status</th>
                      {/* This Treatment = visit items specifically for this treatment plan */}
                      <th className="px-5 py-3 text-right font-medium">This Treatment</th>
                      {/* Visit Paid = total payment for that visit (may cover other treatments too) */}
                      <th className="px-5 py-3 text-right font-medium">
                        Visit Paid
                        <span className="block text-slate-400 normal-case font-normal text-[10px] leading-tight">incl. all treatments</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visits.map((v) => (
                      <tr key={v.visitId} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/dashboard/visits/${v.visitId}`}
                            className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {v.visitCode}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">{v.visitDate}</td>
                        <td className="px-5 py-3.5 text-slate-600">{v.doctorName ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${VISIT_STATUS_BADGE[v.visitStatus] ?? "bg-slate-50 text-slate-700"}`}>
                            {v.visitStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                          {v.treatmentBilledAmount > 0
                            ? formatCurrency(v.treatmentBilledAmount)
                            : <span className="text-slate-300 font-normal">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-600">
                          {formatCurrency(v.visitPaidAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Footer totals row */}
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="px-5 py-3 text-xs text-slate-500 font-medium">Totals</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">
                        {formatCurrency(summary.totalPaid)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-600">
                        {formatCurrency(visits.reduce((acc, v) => acc + v.visitPaidAmount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
