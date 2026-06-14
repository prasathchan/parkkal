"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { visitsApi, appointmentsApi, treatmentsApi, ApiError } from "@/api";
import Link from "next/link";
import { Header } from "@/components/header";
import { VisitHeaderCard } from "@/components/visits/VisitHeaderCard";
import { PaymentModal } from "@/components/visits/PaymentModal";
import { VisitItemsTab } from "@/components/visits/VisitItemsTab";
import { VisitPaymentsTab } from "@/components/visits/VisitPaymentsTab";
import { VisitAttachmentsTab } from "@/components/visits/VisitAttachmentsTab";
import { VisitHistoryTab } from "@/components/visits/VisitHistoryTab";
import { VisitTreatmentPlanTab } from "@/components/visits/VisitTreatmentPlanTab";
import { VisitToothChartTab } from "@/components/visits/VisitToothChartTab";
import { VisitPrescriptionsTab } from "@/components/visits/VisitPrescriptionsTab";
import type {
  Visit, VisitItem, Payment, Attachment, HistoryVisit, Treatment, NewItemState,
} from "@/components/visits/types";
import type { Prescription } from "@/types";

type TabKey = "items" | "payments" | "attachments" | "prescriptions" | "history" | "treatmentPlan" | "chart";

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [items, setItems] = useState<VisitItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  const [tab, setTab] = useState<TabKey>("items");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [markingApptDone, setMarkingApptDone] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);
  const [completingVisit, setCompletingVisit] = useState(false);

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
    const due = visit.totalAmount - visit.paidAmount;
    if (due > 0 && !confirm(`This visit has ₹${due.toFixed(2)} outstanding. Mark as complete anyway?`)) return;
    setCompletingVisit(true);
    setPageError("");
    try {
      await visitsApi.update(id, { status: "COMPLETED" });
      await fetchVisit();
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to complete visit");
    } finally { setCompletingVisit(false); }
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
          <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text rounded-lg px-4 py-3 text-sm flex items-center justify-between">
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} aria-label="Dismiss error" className="ml-4 text-pk-danger-text hover:text-pk-danger-text font-bold leading-none">&times;</button>
          </div>
        )}

        {visit.appointmentId && appointmentStatus && appointmentStatus !== "COMPLETED" && visit.status !== "COMPLETED" && visit.status !== "CANCELLED" && (
          <div className="bg-pk-teal-50 border border-pk-teal-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-pk-teal-800">
              <span>📅</span><span>This visit is linked to a scheduled appointment.</span>
            </div>
            <button onClick={handleMarkAppointmentDone} disabled={markingApptDone} className="text-xs bg-pk-teal-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition">
              {markingApptDone ? "Marking..." : "Mark Appointment Done"}
            </button>
          </div>
        )}
        {visit.appointmentId && (appointmentStatus === "COMPLETED" || visit.status === "COMPLETED") && (
          <div className="bg-pk-success-fill border border-pk-success-border rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-pk-success-text">
            <span>✅</span><span>Appointment marked as completed.</span>
          </div>
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

        <div className="bg-white rounded-xl border border-pk-border shadow-sm overflow-hidden">
          <div className="border-b border-pk-border px-6 flex gap-1 overflow-x-auto">
            {(["items", "payments", "attachments", "prescriptions", "history", "treatmentPlan", "chart"] as TabKey[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? "border-pk-teal-600 text-pk-teal-600" : "border-transparent text-pk-text-muted hover:text-pk-text-secondary"}`}>
                {t === "items" ? "Items" : t === "treatmentPlan" ? "Treatment Plan" : t === "chart" ? "Dental Chart" : t === "prescriptions" ? "Prescriptions" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="p-6">
            {tab === "items" && <VisitItemsTab key={prefillItem ? JSON.stringify(prefillItem) : "items"} visitId={id} visitStatus={visit.status} items={items} treatments={treatments} payments={payments} prefillItem={prefillItem} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "payments" && <VisitPaymentsTab visit={visit} payments={payments} due={due} onOpenPayModal={() => setShowPayModal(true)} />}
            {tab === "attachments" && <VisitAttachmentsTab visitId={id} visitStatus={visit.status} attachments={attachments} patientId={visit.patientId} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "prescriptions" && <VisitPrescriptionsTab visitId={id} visitStatus={visit.status} prescriptions={prescriptions} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "history" && <VisitHistoryTab patientName={visit.patientName ?? ""} history={history} />}
            {tab === "treatmentPlan" && <VisitTreatmentPlanTab visitId={id} visit={visit} treatments={treatments} onRefresh={fetchVisit} onPageError={setPageError} onAddToBill={handleAddToBill} />}
            {tab === "chart" && <VisitToothChartTab visitId={id} patientId={visit.patientId} visitStatus={visit.status} items={items} />}
          </div>
        </div>
      </main>

      {showPayModal && (
        <PaymentModal
          due={due} payForm={payForm} payError={payError} paySubmitting={paySubmitting}
          onChange={setPayForm} onSubmit={handleAddPayment} onClose={() => { setShowPayModal(false); setPayError(""); }}
        />
      )}
    </div>
  );
}
