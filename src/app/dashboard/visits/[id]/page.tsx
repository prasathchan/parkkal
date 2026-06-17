"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { visitsApi, appointmentsApi, treatmentsApi, patientsApi, ApiError } from "@/api";
import Link from "next/link";
import { Header } from "@/components/header";
import { VisitHeaderCard } from "@/components/visits/VisitHeaderCard";
import { PaymentModal } from "@/components/visits/PaymentModal";
import { VisitItemsTab } from "@/components/visits/VisitItemsTab";
import { VisitPaymentsTab } from "@/components/visits/VisitPaymentsTab";
import { VisitAttachmentsTab } from "@/components/visits/VisitAttachmentsTab";
import { VisitPhotosTab } from "@/components/visits/VisitPhotosTab";
import { VisitHistoryTab } from "@/components/visits/VisitHistoryTab";
import { VisitTreatmentPlanTab } from "@/components/visits/VisitTreatmentPlanTab";
import { VisitToothChartTab } from "@/components/visits/VisitToothChartTab";
import { VisitPrescriptionsTab } from "@/components/visits/VisitPrescriptionsTab";
import { LinkSuggestBar } from "@/components/visits/LinkSuggestBar";
import { CompleteVisitModal } from "@/components/visits/CompleteVisitModal";
import type {
  Visit, VisitItem, Payment, Attachment, HistoryVisit, Treatment, NewItemState,
} from "@/components/visits/types";
import type { ClinicalPhoto } from "@/types";
import type { TreatmentDecision } from "@/api/treatments";
import type { ChartData } from "@/components/ui/ToothChart";
import type { Prescription } from "@/types";

type TabKey = "items" | "payments" | "attachments" | "photos" | "prescriptions" | "history" | "treatmentPlan" | "chart";

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [items, setItems] = useState<VisitItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [photos, setPhotos] = useState<ClinicalPhoto[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  const [tab, setTab] = useState<TabKey>("items");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [markingApptDone, setMarkingApptDone] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);
  const [completingVisit, setCompletingVisit] = useState(false);
  const [completeCheckDecisions, setCompleteCheckDecisions] = useState<TreatmentDecision[] | null>(null);
  const [currentChartData, setCurrentChartData] = useState<ChartData>({});

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesForm, setNotesForm] = useState({ chiefComplaint: "", doctorNotes: "", diagnosis: "" });
  const [savingNotes, setSavingNotes] = useState(false);

  const [editingRecall, setEditingRecall] = useState(false);
  const [recallForm, setRecallForm] = useState({ recallDate: "", recallNotes: "" });
  const [savingRecall, setSavingRecall] = useState(false);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
  const [payError, setPayError] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [prefillItem, setPrefillItem] = useState<NewItemState | null>(null);

  // Gap 4 — chart → bill suggestion
  const [chartBillSuggestion, setChartBillSuggestion] = useState<{
    treatmentId: string;
    description: string;
    toothNumber: string;
  } | null>(null);

  // Gap 5 — bill → chart suggestion
  const [billChartSuggestion, setBillChartSuggestion] = useState<string[] | null>(null);
  const [chartHighlightTeeth, setChartHighlightTeeth] = useState<string[]>([]);

  const fetchVisit = useCallback(async () => {
    setLoading(true);
    try {
      const data = await visitsApi.get(id);
      setVisit(data.visit);
      setItems(data.items || []);
      setPayments(data.payments || []);
      setAttachments(data.attachments || []);
      if (data.visit?.appointmentId) {
        appointmentsApi.get(data.visit.appointmentId)
          .then((d) => setAppointmentStatus(d.appointment?.status ?? null))
          .catch(() => setAppointmentStatus(null));
      } else {
        setAppointmentStatus(null);
      }
      treatmentsApi.forVisit.list(id).then((d) => setTreatments(d.treatments ?? [])).catch(() => {});
      visitsApi.prescriptions.list(id).then((d) => setPrescriptions(d.prescriptions ?? [])).catch(() => {});
      visitsApi.photos.list(id).then((d) => setPhotos(d.photos ?? [])).catch(() => {});
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : `Failed to load visit`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchVisit(); }, [fetchVisit]);

  useEffect(() => {
    if (visit?.patientId) {
      visitsApi.list({ patientId: visit.patientId })
        .then((d) => setHistory((d.visits ?? []).filter((v: HistoryVisit) => v.id !== id)))
        .catch(() => {});
    }
  }, [visit?.patientId, id]);

  async function handleSaveNotes(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotes(true);
    setPageError("");
    try {
      await visitsApi.update(id, { chiefComplaint: notesForm.chiefComplaint || null, doctorNotes: notesForm.doctorNotes || null, diagnosis: notesForm.diagnosis || null });
      await fetchVisit();
      setEditingNotes(false);
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to save notes");
    } finally { setSavingNotes(false); }
  }

  async function handleSaveRecall(e: React.FormEvent) {
    e.preventDefault();
    setSavingRecall(true);
    setPageError("");
    try {
      await visitsApi.update(id, { recallDate: recallForm.recallDate || null, recallNotes: recallForm.recallNotes || null });
      await fetchVisit();
      setEditingRecall(false);
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to save recall");
    } finally { setSavingRecall(false); }
  }

  async function handleClearRecall() {
    setSavingRecall(true);
    await visitsApi.update(id, { recallDate: null, recallNotes: null }).catch(() => {});
    await fetchVisit();
    setEditingRecall(false);
    setSavingRecall(false);
  }

  async function handleAddPayment(allowOverpayment = false) {
    if (!visit) return;
    setPayError("");
    setPaySubmitting(true);
    try {
      await visitsApi.payments.add(id, {
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod as "CASH" | "CARD" | "UPI" | "BANK_TRANSFER",
        referenceNumber: payForm.referenceNumber || undefined,
        notes: payForm.notes || undefined,
        allowOverpayment,
      });
      setShowPayModal(false);
      setPayForm({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
      await fetchVisit();
    } catch (e) {
      setPayError(e instanceof ApiError ? e.message : "Payment failed");
    } finally { setPaySubmitting(false); }
  }

  async function handleCompleteVisit() {
    if (!visit) return;
    setCompletingVisit(true);
    setPageError("");
    try {
      // Check if any treatment decisions are needed before completing
      const check = await treatmentsApi.getCompleteCheck(id);
      if (check.needsAttention) {
        // Load current chart data for the modal
        const { toothData } = await patientsApi.getToothChart(visit.patientId);
        setCurrentChartData((toothData as ChartData) ?? {});
        setCompleteCheckDecisions(check.treatments);
        setCompletingVisit(false);
        return;
      }

      // No treatment decisions needed — proceed with outstanding balance check
      const due = visit.totalAmount - visit.paidAmount;
      if (due > 0 && !confirm(`This visit has ₹${due.toFixed(2)} outstanding. Mark as complete anyway?`)) {
        setCompletingVisit(false);
        return;
      }

      await visitsApi.update(id, { status: "COMPLETED" });
      await fetchVisit();
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to complete visit");
    } finally { setCompletingVisit(false); }
  }

  async function handleModalComplete() {
    if (!visit) return;
    const due = visit.totalAmount - visit.paidAmount;
    if (due > 0 && !confirm(`This visit has ₹${due.toFixed(2)} outstanding. Mark as complete anyway?`)) return;
    await visitsApi.update(id, { status: "COMPLETED" });
    setCompleteCheckDecisions(null);
    await fetchVisit();
  }

  async function handleMarkAppointmentDone() {
    if (!visit?.appointmentId) return;
    setMarkingApptDone(true);
    try {
      await appointmentsApi.updateStatus(visit.appointmentId, "COMPLETED");
      setAppointmentStatus("COMPLETED");
      await fetchVisit();
    } finally { setMarkingApptDone(false); }
  }

  function handleChartSuggestBill(treatmentId: string, description: string, toothNumber: string) {
    setChartBillSuggestion({ treatmentId, description, toothNumber });
  }

  function handleBillSuggestChart(toothNumbers: string[]) {
    setBillChartSuggestion(toothNumbers);
  }

  function inferConditionFromTreatment(description: string, procedure?: string | null): string {
    const text = `${description} ${procedure ?? ""}`.toLowerCase();
    if (/root.?canal|rct|endodont/i.test(text)) return "ROOT_CANAL";
    if (/crown|ceramic|porcelain|zirconia|pfm/i.test(text)) return "CROWN";
    if (/implant/i.test(text)) return "IMPLANT";
    if (/bridge/i.test(text)) return "BRIDGE";
    if (/extract|remov|pull|avuls/i.test(text)) return "MISSING";
    if (/fractur|crack|chip/i.test(text)) return "FRACTURED";
    if (/filling|composite|amalgam|restoration/i.test(text)) return "FILLING";
    return "WATCH";
  }

  async function handleLinkTreatments(plans: Treatment[]) {
    for (const plan of plans) {
      await treatmentsApi.forVisit.link(id, { treatmentId: plan.id });

      const alreadyBilledHere = items.some((i) => i.linkedTreatmentId === plan.id);
      const outstanding = Math.max(0, plan.cost - (plan.billedAmount ?? 0));
      if (!alreadyBilledHere && outstanding > 0) {
        const firstTooth = plan.toothNumbers?.split(",")[0]?.trim() ?? "";
        await visitsApi.items.add(id, {
          itemName: plan.description,
          category: "TREATMENT",
          toothNumber: firstTooth || undefined,
          quantity: 1,
          unitPrice: outstanding,
          notes: "",
          linkedTreatmentId: plan.id,
        });
      }

      if (plan.status === "IN_PROGRESS" && plan.toothNumbers) {
        const teeth = plan.toothNumbers.split(",").map((t) => t.trim()).filter(Boolean);
        if (teeth.length > 0) {
          const inferredCondition = inferConditionFromTreatment(plan.description, plan.procedure);
          const { toothData } = await patientsApi.getToothChart(visit!.patientId);
          const updatedChart = { ...(toothData as Record<string, { condition: string }> ?? {}) };
          for (const tooth of teeth) updatedChart[tooth] = { condition: inferredCondition };
          await patientsApi.saveToothChart(
            visit!.patientId,
            updatedChart as Record<string, unknown>,
            id,
            "treatment_start",
            plan.id,
          );
        }
      }
    }
    await fetchVisit();
  }

  function handleAddToBill(item: NewItemState) {
    setPrefillItem(item);
    setTab("items");
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-pk-text-muted">Loading...</div>;
  if (!visit) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-pk-text-muted">{pageError || "Visit not found."}</p>
        <Link href="/dashboard/visits" className="text-pk-teal-600 hover:underline text-sm">Back to Visits</Link>
      </div>
    );
  }

  const due = visit.totalAmount - visit.paidAmount;

  return (
    <div className="flex-1 flex flex-col">
      <Header title={visit.visitCode} breadcrumb={[{ label: "Dashboard" }, { label: "Visits", href: "/dashboard/visits" }, { label: visit.visitCode }]} />
      <main id="main-content" className="flex-1 p-6 space-y-5">
        {pageError && (
          <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text rounded-pk-sm px-4 py-3 text-sm flex items-center justify-between">
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} aria-label="Dismiss error" className="ml-4 text-pk-danger-text hover:text-pk-danger-text font-bold leading-none">&times;</button>
          </div>
        )}

        {visit.appointmentId && appointmentStatus && appointmentStatus !== "COMPLETED" && visit.status !== "COMPLETED" && visit.status !== "CANCELLED" && (
          <div className="bg-pk-teal-50 border border-pk-teal-200 rounded-pk-lg px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-pk-teal-800">
              <span>📅</span><span>This visit is linked to a scheduled appointment.</span>
            </div>
            <button onClick={handleMarkAppointmentDone} disabled={markingApptDone} className="text-xs bg-pk-teal-600 text-white px-3 py-1.5 rounded-pk-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition">
              {markingApptDone ? "Marking..." : "Mark Appointment Done"}
            </button>
          </div>
        )}
        {visit.appointmentId && (appointmentStatus === "COMPLETED" || visit.status === "COMPLETED") && (
          <div className="bg-pk-success-fill border border-pk-success-border rounded-pk-lg px-5 py-3 flex items-center gap-2 text-sm text-pk-success-text">
            <span>✅</span><span>Appointment marked as completed.</span>
          </div>
        )}

        {visit.status === "OPEN" && (
          <LinkSuggestBar
            visitId={id}
            patientId={visit.patientId}
            alreadyLinkedIds={new Set(treatments.map((t) => t.id))}
            onLink={handleLinkTreatments}
          />
        )}

        <VisitHeaderCard
          visitId={id} visit={visit} due={due}
          editingNotes={editingNotes} notesForm={notesForm} savingNotes={savingNotes}
          editingRecall={editingRecall} recallForm={recallForm} savingRecall={savingRecall}
          completingVisit={completingVisit}
          onEditNotes={() => { setNotesForm({ chiefComplaint: visit.chiefComplaint || "", doctorNotes: visit.doctorNotes || "", diagnosis: visit.diagnosis || "" }); setEditingNotes(true); }}
          onNotesChange={setNotesForm}
          onSaveNotes={handleSaveNotes}
          onCancelNotes={() => setEditingNotes(false)}
          onEditRecall={() => { setRecallForm({ recallDate: visit.recallDate || "", recallNotes: visit.recallNotes || "" }); setEditingRecall(true); }}
          onRecallChange={setRecallForm}
          onSaveRecall={handleSaveRecall}
          onCancelRecall={() => setEditingRecall(false)}
          onClearRecall={handleClearRecall}
          onCompleteVisit={handleCompleteVisit}
          onBookFollowup={() => router.push(`/dashboard/appointments/new?patientId=${visit.patientId}&doctorId=${visit.doctorId}&type=FOLLOWUP`)}
          onAddPayment={() => setShowPayModal(true)}
        />

        <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1">
          <div className="border-b border-pk-border px-6 flex gap-1 overflow-x-auto rounded-t-pk-lg overflow-hidden">
            {(["items", "payments", "attachments", "photos", "prescriptions", "history", "treatmentPlan", "chart"] as TabKey[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? "border-pk-teal-600 text-pk-teal-600" : "border-transparent text-pk-text-muted hover:text-pk-text-secondary"}`}>
                {t === "items" ? "Items"
                  : t === "treatmentPlan" ? "Treatment Plan"
                  : t === "chart" ? "Dental Chart"
                  : t === "prescriptions" ? "Prescriptions"
                  : t === "photos"
                    ? (<span className="flex items-center gap-1">Photos{photos.length > 0 && <span className="text-xs bg-pk-teal-100 text-pk-teal-700 px-1.5 rounded-full">{photos.length}</span>}</span>)
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="p-6">
            {/* Gap 4 — chart → bill suggestion banner */}
            {tab === "chart" && chartBillSuggestion && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-pk-lg border border-pk-teal-200 bg-teal-50 px-4 py-3">
                <p className="text-sm text-pk-teal-700 font-medium">
                  <span className="font-semibold">{chartBillSuggestion.description}</span>
                  {" · Tooth "}{chartBillSuggestion.toothNumber}
                  {" — Add to bill?"}
                </p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    className="bg-pk-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 transition"
                    onClick={() => {
                      const tx = treatments.find((t) => t.id === chartBillSuggestion.treatmentId);
                      if (tx) {
                        setPrefillItem({
                          itemName: tx.description,
                          category: "TREATMENT",
                          toothNumber: chartBillSuggestion.toothNumber,
                          quantity: "1",
                          unitPrice: String(Math.max(0, tx.cost - (tx.billedAmount ?? 0))),
                          notes: "",
                          linkedTreatmentId: tx.id,
                        });
                      }
                      setChartBillSuggestion(null);
                      setTab("items");
                    }}
                  >
                    Add item
                  </button>
                  <button
                    type="button"
                    className="text-xs text-pk-text-muted hover:text-pk-text-secondary transition"
                    onClick={() => setChartBillSuggestion(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Gap 5 — bill → chart suggestion banner */}
            {tab === "items" && billChartSuggestion && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-pk-lg border border-pk-teal-200 bg-teal-50 px-4 py-3">
                <p className="text-sm text-pk-teal-700 font-medium">
                  Update the dental chart for{" "}
                  {billChartSuggestion.length === 1
                    ? `tooth ${billChartSuggestion[0]}`
                    : `teeth ${billChartSuggestion.join(", ")}`}?
                </p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    className="bg-pk-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 transition"
                    onClick={() => {
                      setChartHighlightTeeth(billChartSuggestion);
                      setBillChartSuggestion(null);
                      setTab("chart");
                    }}
                  >
                    Update chart
                  </button>
                  <button
                    type="button"
                    className="text-xs text-pk-text-muted hover:text-pk-text-secondary transition"
                    onClick={() => setBillChartSuggestion(null)}
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}

            {tab === "items" && <VisitItemsTab key={prefillItem ? JSON.stringify(prefillItem) : "items"} visitId={id} visitStatus={visit.status} items={items} treatments={treatments} payments={payments} prefillItem={prefillItem} onRefresh={fetchVisit} onPageError={setPageError} onSuggestChart={handleBillSuggestChart} />}
            {tab === "payments" && <VisitPaymentsTab visit={visit} payments={payments} due={due} onOpenPayModal={() => setShowPayModal(true)} />}
            {tab === "attachments" && <VisitAttachmentsTab visitId={id} visitStatus={visit.status} attachments={attachments} patientId={visit.patientId} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "photos" && <VisitPhotosTab visitId={id} visitStatus={visit.status} photos={photos} treatments={treatments} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "prescriptions" && <VisitPrescriptionsTab visitId={id} visitStatus={visit.status} prescriptions={prescriptions} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "history" && <VisitHistoryTab patientName={visit.patientName ?? ""} history={history} />}
            {tab === "treatmentPlan" && <VisitTreatmentPlanTab visitId={id} visit={visit} treatments={treatments} onRefresh={fetchVisit} onPageError={setPageError} onAddToBill={handleAddToBill} onLinkPlan={async (plan) => { await handleLinkTreatments([plan]); }} />}
            {tab === "chart" && <VisitToothChartTab visitId={id} patientId={visit.patientId} visitStatus={visit.status} items={items} treatments={treatments} onSuggestBill={handleChartSuggestBill} externalHighlightTeeth={chartHighlightTeeth} />}
          </div>
        </div>
      </main>

      {showPayModal && (
        <PaymentModal
          due={due} payForm={payForm} payError={payError} paySubmitting={paySubmitting}
          onChange={setPayForm} onSubmit={handleAddPayment} onClose={() => { setShowPayModal(false); setPayError(""); }}
        />
      )}

      {completeCheckDecisions && visit && (
        <CompleteVisitModal
          visitId={id}
          patientId={visit.patientId}
          decisions={completeCheckDecisions}
          currentChartData={currentChartData}
          onComplete={handleModalComplete}
          onCancel={() => setCompleteCheckDecisions(null)}
        />
      )}
    </div>
  );
}
