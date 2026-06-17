"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import { ToothChart } from "@/components/ui/tooth-chart";
import { treatmentsApi, ApiError } from "@/api";
import { TreatmentPhotosSection } from "@/components/treatments/TreatmentPhotosSection";
import { ProgressRing } from "@/components/ui/ProgressRing";
import type { ClinicalPhoto } from "@/types";

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
  treatmentBilledAmount: number;
  doctorName: string | null;
  linkNotes?: string | null;
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
  PLANNED: "bg-pk-warning-fill text-pk-warning-text border-pk-warning-border",
  IN_PROGRESS: "bg-pk-teal-50 text-pk-teal-800 border-pk-teal-200",
  COMPLETED: "bg-pk-success-fill text-pk-success-text border-pk-success-border",
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const CONSENT_BADGE: Record<string, string> = {
  PENDING: "bg-pk-warning-fill text-pk-warning-text border-pk-warning-border",
  UPLOADED: "bg-pk-teal-50 text-pk-teal-700 border-pk-teal-200",
  VERIFIED: "bg-pk-success-fill text-pk-success-text border-pk-success-border",
  REJECTED: "bg-pk-danger-fill text-pk-danger-text border-pk-danger-border",
  EMERGENCY_OVERRIDE: "bg-pk-warning-fill text-pk-warning-text border-pk-warning-border",
};

const CONSENT_LABEL: Record<string, string> = {
  PENDING: "⚠ Consent Pending",
  UPLOADED: "⏳ Awaiting Verification",
  VERIFIED: "✓ Consent Verified",
  REJECTED: "✗ Consent Rejected",
  EMERGENCY_OVERRIDE: "⚡ Emergency Override",
};

const VISIT_STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-pk-teal-50 text-pk-teal-700",
  COMPLETED: "bg-pk-success-fill text-pk-success-text",
  CANCELLED: "bg-pk-danger-fill text-pk-danger-text",
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
  if (pct >= 100) return { bar: "bg-pk-success",  cardBg: "bg-pk-success-fill",  cardBorder: "border-pk-success-border", text: "text-pk-success-text",  label: "text-pk-success-text" };
  if (pct >= 50)  return { bar: "bg-pk-warning", cardBg: "bg-pk-warning-fill", cardBorder: "border-pk-warning-border", text: "text-pk-warning-text", label: "text-pk-warning-text" };
  if (pct >= 25)  return { bar: "bg-pk-warning", cardBg: "bg-pk-warning-fill", cardBorder: "border-pk-warning-border", text: "text-pk-warning-text", label: "text-pk-warning-text" };
  return             { bar: "bg-pk-danger",    cardBg: "bg-pk-danger-fill",    cardBorder: "border-pk-danger-border",    text: "text-pk-danger-text",    label: "text-pk-danger-text" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreatmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [photos, setPhotos] = useState<ClinicalPhoto[]>([]);
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
        treatmentsApi.photos.list(id).then((d) => setPhotos(d.photos ?? [])).catch(() => {});
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
    <div className="min-h-screen bg-pk-surface-raised">
      <Header title={treatment?.description ?? "Treatment Plan"} />
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <nav className="text-sm text-pk-text-muted flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-pk-text-secondary">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/treatments" className="hover:text-pk-text-secondary">Treatment Plans</Link>
          <span>/</span>
          <span className="text-pk-text font-medium truncate max-w-xs">
            {loading ? "Loading…" : (treatment?.description ?? "Treatment Plan")}
          </span>
        </nav>

        {/* Loading */}
        {loading && (
          <div className="bg-pk-surface rounded-pk-xl border border-pk-border p-12 text-center text-pk-text-muted text-sm">
            Loading treatment details…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-pk-danger-fill border border-pk-danger-border rounded-pk-xl p-6 text-center text-pk-danger-text text-sm">
            {error}
          </div>
        )}

        {!loading && treatment && summary && payColors && (
          <>
            {/* ── Header card ── */}
            <div className="bg-pk-surface rounded-pk-xl border border-pk-border p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-xl font-bold text-pk-text">{treatment.description}</h1>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[treatment.status] ?? STATUS_BADGE.PLANNED}`}>
                      {STATUS_LABEL[treatment.status] ?? treatment.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-pk-text-muted flex-wrap mt-1">
                    <Link
                      href={`/dashboard/patients/${treatment.patientId}`}
                      className="hover:text-pk-teal-600 font-medium text-pk-text-secondary"
                    >
                      {treatment.patientName ?? "Unknown Patient"}
                      {treatment.patientCode && (
                        <span className="ml-1 text-pk-text-muted font-normal">({treatment.patientCode})</span>
                      )}
                    </Link>
                    {treatment.doctorName && <span>Dr. {treatment.doctorName}</span>}
                    <span>{new Date(treatment.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>

                {/* Progress ring + Book next session */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ProgressRing percent={summary.paidPercent} size={52} strokeWidth={5} />
                  {treatment.status !== "COMPLETED" && (
                    <Link
                      href={`/dashboard/appointments/new?patientId=${treatment.patientId}&type=FOLLOWUP&notes=${encodeURIComponent(`Follow-up: ${treatment.description}`)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium bg-pk-teal-600 text-white px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 transition whitespace-nowrap"
                    >
                      Book next session →
                    </Link>
                  )}
                </div>
              </div>

              {/* Treatment details */}
              {(treatment.procedure || toothList.length > 0) && (
                <div className="mt-4 pt-4 border-t border-pk-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {treatment.procedure && (
                    <div>
                      <p className="text-xs text-pk-text-muted mb-1">Procedure Notes</p>
                      <p className="text-sm text-pk-text-secondary">{treatment.procedure}</p>
                    </div>
                  )}
                  {toothList.length > 0 && (
                    <div>
                      <p className="text-xs text-pk-text-muted mb-2">Tooth Selection</p>
                      <ToothChart value={toothList} readOnly compact />
                    </div>
                  )}
                </div>
              )}

              {/* Consent row */}
              <div className="mt-4 pt-4 border-t border-pk-border flex flex-wrap items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${CONSENT_BADGE[treatment.consentStatus] ?? CONSENT_BADGE.PENDING}`}>
                  {CONSENT_LABEL[treatment.consentStatus] ?? treatment.consentStatus}
                </span>
                {treatment.consentNotes && (
                  <span className="text-xs text-pk-text-muted italic">{treatment.consentNotes}</span>
                )}
                {treatment.emergencyReason && (
                  <span className="text-xs text-pk-warning-text">Reason: {treatment.emergencyReason}</span>
                )}
                {treatment.consentDocumentUrl && (
                  <a
                    href={treatment.consentDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-pk-teal-600 hover:underline"
                  >
                    View Consent Document ↗
                  </a>
                )}
                <a
                  href={`/api/treatments/${treatment.id}/consent-pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs border border-pk-border text-pk-text-secondary px-2.5 py-1 rounded-pk-sm hover:bg-pk-surface-raised transition ml-auto"
                >
                  Download Consent Form PDF
                </a>
              </div>
            </div>

            {/* ── Financial summary ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Box 1 — Treatment Cost (neutral) */}
              <div className="bg-pk-surface rounded-pk-lg border border-pk-border p-5 text-center">
                <p className="text-xs text-pk-text-muted mb-1.5">Treatment Cost</p>
                <p className="text-2xl font-bold text-pk-text">{formatCurrency(summary.treatmentCost)}</p>
              </div>

              {/* Box 2 — Total Paid (colored + progress bar) */}
              <div className={`rounded-pk-lg border p-5 ${payColors.cardBg} ${payColors.cardBorder}`}>
                <p className={`text-xs font-medium mb-1.5 ${payColors.label}`}>Total Paid</p>
                <p className={`text-2xl font-bold mb-2 ${payColors.text}`}>
                  {formatCurrency(summary.totalPaid)}
                </p>
                {/* Progress bar */}
                <div className="w-full bg-pk-border rounded-full h-2 overflow-hidden">
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
                <div className="bg-pk-danger-fill rounded-pk-lg border border-pk-danger-border p-5 text-center">
                  <p className="text-xs text-pk-danger-text mb-1.5">Outstanding</p>
                  <p className="text-2xl font-bold text-pk-danger-text">{formatCurrency(summary.outstanding)}</p>
                  <p className="text-xs text-pk-danger-text mt-1.5">Not yet charged</p>
                </div>
              ) : (
                <div className="bg-pk-success-fill rounded-pk-lg border border-pk-success-border p-5 text-center flex flex-col items-center justify-center">
                  <span className="text-2xl mb-1">✓</span>
                  <p className="text-sm font-semibold text-pk-success-text">Fully Settled</p>
                  <p className="text-xs text-pk-success-text mt-0.5">No balance remaining</p>
                </div>
              )}
            </div>

            {/* ── Clinical Photos ── */}
            <TreatmentPhotosSection photos={photos} />

            {/* ── Visit History ── */}
            <div className="bg-pk-surface rounded-pk-xl border border-pk-border overflow-hidden">
              <div className="px-6 py-4 border-b border-pk-border">
                <h2 className="text-sm font-semibold text-pk-text">
                  Visit History
                  <span className="ml-2 text-pk-text-muted font-normal">
                    ({summary.visitCount} {summary.visitCount === 1 ? "visit" : "visits"})
                  </span>
                </h2>
              </div>

              {visits.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-pk-text-muted">
                  This treatment plan has not been linked to any visit yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-pk-surface-raised text-xs text-pk-text-muted uppercase tracking-wide">
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
                        <span className="block text-pk-text-muted normal-case font-normal text-[10px] leading-tight">incl. all treatments</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pk-border">
                    {visits.map((v) => (
                      <tr key={v.visitId} className="hover:bg-pk-surface-raised transition">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/dashboard/visits/${v.visitId}`}
                            className="font-mono text-xs text-pk-teal-600 hover:text-pk-teal-800 hover:underline"
                          >
                            {v.visitCode}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-pk-text-secondary">{v.visitDate}</td>
                        <td className="px-5 py-3.5 text-pk-text-secondary">{v.doctorName ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${VISIT_STATUS_BADGE[v.visitStatus] ?? "bg-pk-surface-raised text-pk-text-secondary"}`}>
                            {v.visitStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-pk-text">
                          {v.treatmentBilledAmount > 0
                            ? formatCurrency(v.treatmentBilledAmount)
                            : <span className="text-pk-text-muted font-normal">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-pk-text-secondary">
                          {formatCurrency(v.visitPaidAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Footer totals row */}
                  <tfoot className="bg-pk-surface-raised border-t border-pk-border">
                    <tr>
                      <td colSpan={4} className="px-5 py-3 text-xs text-pk-text-muted font-medium">Totals</td>
                      <td className="px-5 py-3 text-right font-bold text-pk-text">
                        {formatCurrency(summary.totalPaid)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-pk-text-secondary">
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
