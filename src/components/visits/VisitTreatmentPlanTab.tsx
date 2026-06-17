"use client";

import { useState, useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/utils";
import { ToothChart } from "@/components/ui/tooth-chart";
import { PAYMENT_METHODS, type NewItemState, type Treatment, type Visit } from "./types";
import { treatmentsApi, visitsApi, ApiError } from "@/api";
import type { TreatmentTemplate } from "@/api/treatments";
import { ProgressRing } from "@/components/ui/ProgressRing";

interface Props {
  visitId: string;
  visit: Visit;
  treatments: Treatment[];
  onRefresh: () => Promise<void>;
  onPageError: (msg: string) => void;
  /** Called when user clicks "Add to Bill" — switches to items tab with pre-filled form */
  onAddToBill: (item: NewItemState) => void;
  /** Called when an existing plan is linked — triggers bill item + chart update */
  onLinkPlan?: (plan: Treatment) => Promise<void>;
}

export function VisitTreatmentPlanTab({ visitId, visit, treatments, onRefresh, onPageError, onAddToBill, onLinkPlan }: Props) {
  // Add treatment form
  const [txForm, setTxForm] = useState({ description: "", toothNumbers: [] as string[], procedure: "", cost: "0" });
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txError, setTxError] = useState("");
  const [_txUpdating, setTxUpdating] = useState<string | null>(null);

  // Link existing plan modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkablePlans, setLinkablePlans] = useState<Treatment[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);

  // Treatment-attributed payment modal
  const [txPayModal, setTxPayModal] = useState<{ treatmentId: string; description: string; cost: number } | null>(null);
  const [txPayForm, setTxPayForm] = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
  const [txPayError, setTxPayError] = useState("");
  const [txPaySubmitting, setTxPaySubmitting] = useState(false);

  // Consent
  const [consentUploading, setConsentUploading] = useState<string | null>(null);
  const [consentUploadError, setConsentUploadError] = useState<Record<string, string>>({});

  // Override modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideTxId, setOverrideTxId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  // IN_PROGRESS without consent warning
  const [pendingStatusChange, setPendingStatusChange] = useState<{ txId: string; status: string } | null>(null);

  // Session notes — keyed by treatmentId, autosaved on blur
  const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
  const [notesSaving, setNotesSaving] = useState<Record<string, boolean>>({});

  // Treatment templates
  const [templates, setTemplates] = useState<TreatmentTemplate[]>([]);
  const [txSuggestions, setTxSuggestions] = useState<string[]>([]);
  const suggestRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // L2: deferred link-prompt — shown once per visit, dismissed via sessionStorage
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [unlinkablePlans, setUnlinkablePlans] = useState<Treatment[]>([]);

  const DISMISS_KEY = `pk_visit_link_dismissed_${visitId}`;

  useEffect(() => {
    treatmentsApi.templates.list().then((d) => setTemplates(d.templates ?? [])).catch(() => {});
  }, []);

  // Seed session notes from server data (runs when treatments first load)
  useEffect(() => {
    setSessionNotes((prev) => {
      const updated = { ...prev };
      for (const tx of treatments) {
        if (!(tx.id in updated)) updated[tx.id] = tx.linkNotes ?? "";
      }
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treatments.map(t => t.id).join(",")]);

  useEffect(() => {
    if (visit.status !== "OPEN") return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    if (treatments.length > 0) return; // already has linked plans

    // Check for existing unlinked plans for this patient
    treatmentsApi.list({ patientId: visit.patientId, status: "PLANNED" }).then((d) => {
      const plans = (d.treatments ?? []).filter((t: Treatment) => t.status !== "COMPLETED");
      if (plans.length > 0) {
        setUnlinkablePlans(plans);
        setShowLinkPrompt(true);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  async function handleAddTreatment(e: React.FormEvent) {
    e.preventDefault();
    setTxSubmitting(true);
    setTxError("");
    // L7: require at least one tooth number unless it looks like a consultation
    const isConsultation = /consult/i.test(txForm.description) || /consult/i.test(txForm.procedure);
    if (!isConsultation && txForm.toothNumbers.length === 0) {
      setTxError("Please select at least one tooth. For consultations without a specific tooth, include 'consultation' in the description.");
      setTxSubmitting(false);
      return;
    }
    try {
      await treatmentsApi.forVisit.link(visitId, {
        description: txForm.description,
        toothNumbers: txForm.toothNumbers.length > 0 ? txForm.toothNumbers.join(",") : undefined,
        procedure: txForm.procedure || undefined,
        cost: Number(txForm.cost),
      });
      setTxForm({ description: "", toothNumbers: [], procedure: "", cost: "0" });
      await onRefresh();
    } catch (err) {
      setTxError(err instanceof ApiError ? err.message : "Network error. Please try again.");
    } finally {
      setTxSubmitting(false);
    }
  }

  async function handleUpdateTreatmentStatus(txId: string, status: string) {
    setTxUpdating(txId);
    try {
      await treatmentsApi.update(txId, { status: status as import("@/constants/treatment").TreatmentStatus });
      await onRefresh();
    } catch (err) {
      onPageError(err instanceof ApiError ? err.message : "Failed to update treatment status");
    } finally {
      setTxUpdating(null);
    }
  }

  async function handleUnlinkTreatment(txId: string) {
    if (!confirm("Unlink this treatment plan from this visit? The plan itself will not be deleted.")) return;
    try {
      await treatmentsApi.forVisit.unlink(visitId, txId);
      await onRefresh();
    } catch (err) {
      onPageError(err instanceof ApiError ? err.message : "Failed to unlink treatment");
    }
  }

  async function handleOpenLinkModal() {
    setLinkLoading(true);
    setShowLinkModal(true);
    try {
      const d = await treatmentsApi.list({ patientId: visit.patientId });
      const linkedIds = new Set(treatments.map(t => t.id));
      // Issue 2: exclude already-linked and COMPLETED plans
      setLinkablePlans((d.treatments || []).filter(
        (t: Treatment) => !linkedIds.has(t.id) && t.status !== "COMPLETED"
      ));
    } catch { /* silently ignore — user sees empty state */ }
    setLinkLoading(false);
  }

  // Issue 3A: link only — no bill item created
  async function handleLinkOnly(txId: string) {
    setShowLinkModal(false);
    try {
      await treatmentsApi.forVisit.link(visitId, { treatmentId: txId });
      await onRefresh();
    } catch (err) {
      onPageError(err instanceof ApiError ? err.message : "Failed to link treatment");
    }
  }

  // Issue 3B: link + add bill item for outstanding balance
  async function handleLinkAndBill(txId: string) {
    const plan = linkablePlans.find((p) => p.id === txId);
    setShowLinkModal(false);
    try {
      if (plan && onLinkPlan) {
        await onLinkPlan(plan);
      } else {
        await treatmentsApi.forVisit.link(visitId, { treatmentId: txId });
        await onRefresh();
      }
    } catch (err) {
      onPageError(err instanceof ApiError ? err.message : "Failed to link treatment");
    }
  }

  async function handleAddTreatmentPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!txPayModal) return;
    setTxPayError("");
    setTxPaySubmitting(true);
    try {
      await visitsApi.payments.add(visitId, {
        amount: Number(txPayForm.amount),
        paymentMethod: txPayForm.paymentMethod as import("@/constants/visit").PaymentMethod,
        referenceNumber: txPayForm.referenceNumber || null,
        notes: txPayForm.notes || null,
        treatmentId: txPayModal.treatmentId,
      });
      setTxPayModal(null);
      setTxPayForm({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
      await onRefresh();
    } catch (err) {
      setTxPayError(err instanceof ApiError ? err.message : "Payment failed");
    } finally {
      setTxPaySubmitting(false);
    }
  }

  async function handleSaveNotes(txId: string, notes: string) {
    setNotesSaving(prev => ({ ...prev, [txId]: true }));
    try {
      await treatmentsApi.forVisit.updateNotes(visitId, txId, notes || null);
    } catch {
      // silently fail — notes are not critical; user can retry by blurring again
    } finally {
      setNotesSaving(prev => ({ ...prev, [txId]: false }));
    }
  }

  async function handleConsentUpload(txId: string, file: File) {
    setConsentUploading(txId);
    setConsentUploadError(prev => ({ ...prev, [txId]: "" }));
    try {
      await treatmentsApi.consent.upload(txId, file);
      await onRefresh();
    } catch (err) {
      setConsentUploadError(prev => ({ ...prev, [txId]: err instanceof ApiError ? err.message : "Upload failed" }));
    } finally {
      setConsentUploading(null);
    }
  }

  async function handleEmergencyOverride() {
    if (!overrideTxId) return;
    setOverrideSubmitting(true);
    setOverrideError("");
    try {
      await treatmentsApi.consent.override(overrideTxId, overrideReason);
      setShowOverrideModal(false);
      setOverrideTxId(null);
      setOverrideReason("");
      await onRefresh();
    } catch (err) {
      setOverrideError(err instanceof ApiError ? err.message : "Override failed");
    } finally {
      setOverrideSubmitting(false);
    }
  }

  const consentBadge: Record<string, string> = {
    PENDING: "bg-pk-warning-fill text-pk-warning-text border-pk-warning-border",
    UPLOADED: "bg-pk-teal-50 text-pk-teal-700 border-pk-teal-200",
    VERIFIED: "bg-pk-success-fill text-pk-success-text border-pk-success-border",
    REJECTED: "bg-pk-danger-fill text-pk-danger-text border-pk-danger-border",
    EMERGENCY_OVERRIDE: "bg-pk-warning-fill text-pk-warning-text border-pk-warning-border",
  };
  const consentLabel: Record<string, string> = {
    PENDING: "⚠ Consent Pending",
    UPLOADED: "⏳ Awaiting Verification",
    VERIFIED: "✓ Consent Verified",
    REJECTED: "✗ Consent Rejected",
    EMERGENCY_OVERRIDE: "⚡ Emergency Override",
  };

  return (
    <>
      {/* L2: deferred link-prompt — shown once per visit session */}
      {showLinkPrompt && (
        <div className="bg-pk-teal-50 border border-pk-teal-200 rounded-pk-lg px-4 py-3 flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-pk-teal-800">Existing treatment plan{unlinkablePlans.length > 1 ? "s" : ""} found</p>
            <p className="text-xs text-pk-teal-600 mt-0.5">
              {unlinkablePlans.length === 1
                ? `"${unlinkablePlans[0].description}" — link it to this visit to track payments.`
                : `${unlinkablePlans.length} plans available — link them to track payments in this visit.`}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setShowLinkPrompt(false); handleOpenLinkModal(); }}
              className="text-xs bg-pk-teal-600 text-white px-3 py-1.5 rounded-pk-sm font-medium hover:bg-pk-teal-700 transition"
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => { sessionStorage.setItem(DISMISS_KEY, "1"); setShowLinkPrompt(false); }}
              className="text-xs border border-pk-teal-300 text-pk-teal-700 px-3 py-1.5 rounded-pk-sm font-medium hover:bg-pk-teal-100 transition"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {visit.status !== "CANCELLED" && (
          <form onSubmit={handleAddTreatment} className="bg-pk-surface-raised rounded-pk-lg p-4 space-y-3 border border-pk-border">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-pk-text-secondary">Add Treatment Item</p>
              <button
                type="button"
                onClick={handleOpenLinkModal}
                className="text-xs text-pk-teal-600 hover:text-pk-teal-800 font-medium"
              >
                + Link Existing Plan
              </button>
            </div>

            {templates.length > 0 && (
              <div>
                <label className="block text-xs text-pk-text-muted mb-1">Start from template</label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (!t) return;
                    setTxForm(f => ({
                      ...f,
                      description: t.description,
                      procedure: t.procedure ?? "",
                      cost: String(t.defaultCost),
                    }));
                  }}
                  className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm bg-pk-surface-raised text-pk-text-secondary focus:outline-none focus:ring-1 focus:ring-pk-teal-400"
                >
                  <option value="">— Template (optional) —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-pk-text-muted mb-1">Description *</label>
                <input
                  required
                  list="vt-desc-suggestions"
                  value={txForm.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTxForm(f => ({ ...f, description: val }));
                    if (suggestRef.current) clearTimeout(suggestRef.current);
                    suggestRef.current = setTimeout(() => {
                      if (val.length >= 2) {
                        treatmentsApi.suggest(val).then((d) => setTxSuggestions(d.suggestions ?? [])).catch(() => {});
                      } else {
                        setTxSuggestions([]);
                      }
                    }, 200);
                  }}
                  placeholder="e.g. Root Canal Treatment"
                  className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                />
                <datalist id="vt-desc-suggestions">
                  {txSuggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-pk-text-muted mb-1">Est. Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={txForm.cost}
                  onChange={(e) => setTxForm(f => ({ ...f, cost: e.target.value }))}
                  className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-pk-text-muted mb-2">Tooth Selection (FDI)</label>
              <ToothChart
                value={txForm.toothNumbers}
                onChange={(teeth) => setTxForm(f => ({ ...f, toothNumbers: teeth }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-pk-text-muted mb-1">Procedure Notes</label>
                <input
                  value={txForm.procedure}
                  onChange={(e) => setTxForm(f => ({ ...f, procedure: e.target.value }))}
                  placeholder="Optional procedure details..."
                  className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                />
              </div>
              <div className="pt-5 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={txSubmitting}
                  className="bg-pk-teal-600 text-white px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition"
                >
                  {txSubmitting ? "Adding..." : "Add"}
                </button>
                {txError && <p className="text-xs text-pk-danger-text">{txError}</p>}
              </div>
            </div>
          </form>
        )}

        {treatments.length === 0 ? (
          <p className="text-center text-pk-text-muted text-sm py-6">No treatment items yet</p>
        ) : (
          <>
            <div className="space-y-3">
              {treatments.map((tx) => {
                const txPaid = tx.billedAmount ?? 0;
                const txOutstanding = Math.max(0, tx.cost - txPaid);
                return (
                  <div key={tx.id} className={`border rounded-pk-lg p-4 transition ${tx.status === "COMPLETED" ? "bg-pk-surface-raised border-pk-border opacity-75" : "bg-pk-surface border-pk-border"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${tx.status === "COMPLETED" ? "line-through text-pk-text-muted" : "text-pk-text"}`}>{tx.description}</p>
                          {tx.toothNumbers && (
                            <ToothChart
                              value={tx.toothNumbers.split(",").map(s => s.trim()).filter(Boolean)}
                              readOnly
                              compact
                            />
                          )}
                        </div>
                        {tx.procedure && <p className="text-xs text-pk-text-muted mt-0.5">{tx.procedure}</p>}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-sm font-medium text-pk-text-secondary">Cost: {formatCurrency(tx.cost)}</span>
                          <span className="text-xs text-pk-success-text bg-pk-success-fill px-2 py-0.5 rounded-full">Paid: {formatCurrency(txPaid)}</span>
                          {txOutstanding > 0 && (
                            <span className="text-xs text-pk-danger-text bg-pk-danger-fill px-2 py-0.5 rounded-full">Due: {formatCurrency(txOutstanding)}</span>
                          )}
                          {txOutstanding === 0 && txPaid > 0 && (
                            <span className="text-xs text-pk-success-text bg-pk-success-fill px-2 py-0.5 rounded-full font-medium">✓ Settled</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <ProgressRing
                          percent={tx.cost > 0 ? Math.round((txPaid / tx.cost) * 100) : (txPaid > 0 ? 100 : 0)}
                          size={36}
                          strokeWidth={3}
                        />
                        {visit.status !== "CANCELLED" && txOutstanding > 0 && (() => {
                          const consentOk = ["VERIFIED", "EMERGENCY_OVERRIDE"].includes(tx.consentStatus);
                          if (consentOk) {
                            return (
                              <button
                                onClick={() => {
                                  const teeth = tx.toothNumbers ? tx.toothNumbers.split(",").map(s => s.trim()).filter(Boolean) : [];
                                  const firstTooth = teeth[0] ?? "";
                                  // Gap A: if multi-tooth, surface all teeth in notes
                                  const multiToothNote = teeth.length > 1 ? `Teeth: ${teeth.join(", ")}` : "";
                                  onAddToBill({
                                    itemName: tx.description,
                                    category: "TREATMENT",
                                    toothNumber: firstTooth,
                                    quantity: "1",
                                    unitPrice: String(txOutstanding),
                                    notes: multiToothNote,
                                    linkedTreatmentId: tx.id,
                                  });
                                }}
                                className="text-xs bg-pk-neutral-600 text-white px-2.5 py-1.5 rounded-pk-sm hover:bg-pk-neutral-700 transition font-medium"
                              >
                                Add to Bill
                              </button>
                            );
                          }
                          return (
                            <span
                              title="Upload and verify consent to enable billing"
                              className="text-xs text-pk-warning-text bg-pk-warning-fill border border-pk-warning-border px-2.5 py-1.5 rounded-pk-sm flex items-center gap-1 cursor-default"
                            >
                              🔒 Consent required
                            </span>
                          );
                        })()}
                        {/* Status badge — read-only for OPEN visits (status changes
                            are handled by the Complete Visit modal to avoid mid-session
                            interruptions). COMPLETED visits show a plain badge. */}
                        <span className={`text-xs border rounded-pk-sm px-2 py-1.5 font-medium ${
                          tx.status === "PLANNED"     ? "bg-pk-warning-fill border-pk-warning-border text-pk-warning-text"
                          : tx.status === "IN_PROGRESS" ? "bg-pk-teal-50 border-pk-teal-200 text-pk-teal-800"
                          : "bg-pk-success-fill border-pk-success-border text-pk-success-text"
                        }`}>
                          {tx.status === "PLANNED" ? "Planned" : tx.status === "IN_PROGRESS" ? "In Progress" : "Completed"}
                        </span>
                        {visit.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleUnlinkTreatment(tx.id)}
                            className="text-xs text-pk-text-muted hover:text-pk-danger-text"
                            title="Unlink from this visit"
                          >
                            Unlink
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Session notes — only editable in open visits */}
                    <div className="mt-3 pt-3 border-t border-pk-border">
                      {visit.status === "OPEN" ? (
                        <div className="relative">
                          <textarea
                            rows={2}
                            placeholder="Session notes for this visit… (auto-saves)"
                            value={sessionNotes[tx.id] ?? ""}
                            onChange={(e) => setSessionNotes(prev => ({ ...prev, [tx.id]: e.target.value }))}
                            onBlur={(e) => handleSaveNotes(tx.id, e.target.value)}
                            maxLength={500}
                            className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-xs text-pk-text-secondary bg-pk-surface-raised focus:outline-none focus:ring-1 focus:ring-pk-teal-400 resize-none placeholder:text-pk-text-muted"
                          />
                          {notesSaving[tx.id] && (
                            <span className="absolute bottom-2 right-2 text-[10px] text-pk-text-muted">Saving…</span>
                          )}
                        </div>
                      ) : (sessionNotes[tx.id] || tx.linkNotes) ? (
                        <p className="text-xs text-pk-text-secondary italic">{sessionNotes[tx.id] || tx.linkNotes}</p>
                      ) : null}
                    </div>

                    {/* Consent row */}
                    <div className="mt-3 pt-3 border-t border-pk-border flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${consentBadge[tx.consentStatus] ?? consentBadge.PENDING}`}>
                        {consentLabel[tx.consentStatus] ?? tx.consentStatus}
                      </span>
                      {tx.consentNotes && (
                        <span className="text-xs text-pk-text-muted italic">{tx.consentNotes}</span>
                      )}
                      {tx.consentDocumentUrl && (
                        <a href={tx.consentDocumentUrl} target="_blank" rel="noreferrer" className="text-xs text-pk-teal-600 hover:underline">
                          View document
                        </a>
                      )}
                      <div className="flex items-center gap-2 ml-auto flex-wrap">
                        <a
                          href="/dashboard/treatments/consent"
                          target="_blank"
                          className="text-xs text-pk-text-muted hover:text-pk-teal-600"
                        >
                          Print Form
                        </a>
                        {tx.consentStatus !== "VERIFIED" && tx.consentStatus !== "EMERGENCY_OVERRIDE" && (
                          <label className={`text-xs px-2 py-1 rounded-pk-sm font-medium cursor-pointer transition ${consentUploading === tx.id ? "bg-pk-surface-sunken text-pk-text-muted" : "bg-pk-teal-50 text-pk-teal-700 hover:bg-pk-teal-100"}`}>
                            {consentUploading === tx.id ? "Uploading..." : "Upload Consent"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              className="hidden"
                              disabled={consentUploading === tx.id}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleConsentUpload(tx.id, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                        <button
                          onClick={() => { setOverrideTxId(tx.id); setOverrideReason(""); setOverrideError(""); setShowOverrideModal(true); }}
                          className="text-xs text-pk-warning-text hover:text-pk-warning-text font-medium"
                        >
                          Emergency Override
                        </button>
                      </div>
                      {consentUploadError[tx.id] && (
                        <p className="w-full text-xs text-pk-danger-text mt-1">{consentUploadError[tx.id]}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-pk-border text-sm">
              <span className="text-pk-text-muted">
                {treatments.filter(t => t.status === "COMPLETED").length} of {treatments.length} completed
              </span>
              <span className="font-semibold text-pk-text-secondary">
                Est. total: {formatCurrency(treatments.reduce((s, t) => s + t.cost, 0))}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Treatment Payment Modal */}
      {txPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-pk-surface rounded-pk-lg shadow-pk-e3 w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-pk-text">Record Treatment Payment</h3>
              <p className="text-sm text-pk-text-muted mt-0.5">
                For: <span className="font-medium text-pk-neutral-700">🦷 {txPayModal.description}</span>
              </p>
            </div>
            {txPayError && (
              <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-3 py-2">{txPayError}</div>
            )}
            <form onSubmit={handleAddTreatmentPayment} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={txPayForm.amount}
                  onChange={(e) => setTxPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-pk-border-strong rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-neutral-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1">Payment Method</label>
                <select
                  value={txPayForm.paymentMethod}
                  onChange={(e) => setTxPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  className="w-full border border-pk-border-strong rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-neutral-500"
                >
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1">Reference No.</label>
                <input
                  value={txPayForm.referenceNumber}
                  onChange={(e) => setTxPayForm(f => ({ ...f, referenceNumber: e.target.value }))}
                  placeholder="Optional"
                  className="w-full border border-pk-border-strong rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-neutral-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={txPaySubmitting}
                  className="flex-1 bg-pk-neutral-600 text-white px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-neutral-700 disabled:opacity-50 transition"
                >
                  {txPaySubmitting ? "Saving..." : "Confirm Payment"}
                </button>
                <button
                  type="button"
                  onClick={() => setTxPayModal(null)}
                  className="px-4 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Existing Plan Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-pk-surface rounded-pk-xl shadow-pk-e3 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-pk-border">
              <h3 className="text-base font-semibold text-pk-text">Link Existing Treatment Plan</h3>
              <button onClick={() => setShowLinkModal(false)} aria-label="Close modal" className="text-pk-text-muted hover:text-pk-text-secondary text-xl leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {linkLoading ? (
                <p className="text-sm text-pk-text-muted text-center py-6">Loading...</p>
              ) : linkablePlans.length === 0 ? (
                <p className="text-sm text-pk-text-muted text-center py-6">No active treatment plans found for this patient. Create one from the Treatment Plans page first.</p>
              ) : (
                linkablePlans.map(plan => {
                  const outstanding = Math.max(0, plan.cost - (plan.billedAmount ?? 0));
                  return (
                    <div key={plan.id} className="border border-pk-border rounded-pk-lg p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-pk-text">{plan.description}</p>
                          {plan.procedure && <p className="text-xs text-pk-text-muted mt-0.5">{plan.procedure}</p>}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${plan.status === "PLANNED" ? "bg-pk-warning-fill text-pk-warning-text" : "bg-pk-teal-50 text-pk-teal-700"}`}>
                              {plan.status === "IN_PROGRESS" ? "In Progress" : "Planned"}
                            </span>
                            <span className="text-xs text-pk-text-muted">{formatCurrency(plan.cost)}</span>
                            {outstanding > 0 && (
                              <span className="text-xs text-pk-danger-text">Due: {formatCurrency(outstanding)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Issue 3: two CTAs */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleLinkOnly(plan.id)}
                          className="flex-1 text-xs border border-pk-border text-pk-text-secondary px-3 py-1.5 rounded-pk-sm hover:bg-pk-surface-raised transition font-medium"
                        >
                          Link Only
                        </button>
                        <button
                          onClick={() => handleLinkAndBill(plan.id)}
                          className="flex-1 text-xs bg-pk-teal-600 text-white px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 transition font-medium"
                        >
                          Link &amp; Add to Bill
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-pk-surface rounded-pk-lg shadow-pk-e3 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-pk-text mb-1">Emergency Override</h3>
            <p className="text-sm text-pk-text-muted mb-4">Record a clinical reason to proceed without a signed consent form.</p>
            {overrideError && (
              <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3 mb-4">{overrideError}</div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-pk-text-secondary mb-1">Reason <span className="text-pk-danger-text">*</span></label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="Describe the clinical reason for proceeding without consent (min 5 characters)..."
                className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-warning resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEmergencyOverride}
                disabled={overrideSubmitting || overrideReason.trim().length < 5}
                className="flex-1 bg-pk-warning text-white px-4 py-2.5 rounded-pk-sm text-sm font-medium hover:bg-pk-warning disabled:opacity-50 transition"
              >
                {overrideSubmitting ? "Saving..." : "Apply Override"}
              </button>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2.5 border border-pk-border rounded-pk-sm text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN_PROGRESS without consent warning */}
      {pendingStatusChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-pk-surface rounded-pk-lg shadow-pk-e3 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-pk-text mb-2">⚠️ Consent Not Verified</h3>
            <p className="text-sm text-pk-text-secondary mb-4">
              This treatment does not have a verified consent form. Starting treatment without consent may have legal and clinical implications.
            </p>
            <p className="text-sm text-pk-text-secondary mb-6">Do you want to proceed anyway or apply an emergency override?</p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => {
                  handleUpdateTreatmentStatus(pendingStatusChange.txId, pendingStatusChange.status);
                  setPendingStatusChange(null);
                }}
                className="flex-1 bg-pk-neutral-700 text-white px-4 py-2.5 rounded-pk-sm text-sm font-medium hover:bg-pk-neutral-800 transition"
              >
                Proceed Anyway
              </button>
              <button
                onClick={() => {
                  const tx = treatments.find(t => t.id === pendingStatusChange.txId);
                  if (tx) { setOverrideTxId(tx.id); setOverrideReason(""); setOverrideError(""); setShowOverrideModal(true); }
                  setPendingStatusChange(null);
                }}
                className="flex-1 bg-pk-warning text-white px-4 py-2.5 rounded-pk-sm text-sm font-medium hover:bg-pk-warning transition"
              >
                Emergency Override
              </button>
              <button
                onClick={() => setPendingStatusChange(null)}
                className="w-full border border-pk-border rounded-pk-sm px-4 py-2.5 text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
