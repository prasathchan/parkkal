"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { visitsApi, appointmentsApi, treatmentsApi, ApiError } from "@/api";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { PAYMENT_METHODS, STATUS_COLORS } from "@/components/visits/types";
import { VisitItemsTab } from "@/components/visits/VisitItemsTab";
import { VisitPaymentsTab } from "@/components/visits/VisitPaymentsTab";
import { VisitAttachmentsTab } from "@/components/visits/VisitAttachmentsTab";
import { VisitHistoryTab } from "@/components/visits/VisitHistoryTab";
import { VisitTreatmentPlanTab } from "@/components/visits/VisitTreatmentPlanTab";
import { VisitToothChartTab } from "@/components/visits/VisitToothChartTab";
import type {
  Visit,
  VisitItem,
  Payment,
  Attachment,
  HistoryVisit,
  Treatment,
  NewItemState,
} from "@/components/visits/types";

type TabKey = "items" | "payments" | "attachments" | "history" | "treatmentPlan" | "chart";

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Server data
  const [visit, setVisit] = useState<Visit | null>(null);
  const [items, setItems] = useState<VisitItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  // UI state
  const [tab, setTab] = useState<TabKey>("items");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Appointment
  const [markingApptDone, setMarkingApptDone] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);

  // Complete visit
  const [completingVisit, setCompletingVisit] = useState(false);

  // Clinical notes inline edit
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesForm, setNotesForm] = useState({ chiefComplaint: "", doctorNotes: "", diagnosis: "" });
  const [savingNotes, setSavingNotes] = useState(false);

  // Recall inline edit
  const [editingRecall, setEditingRecall] = useState(false);
  const [recallForm, setRecallForm] = useState({ recallDate: "", recallNotes: "" });
  const [savingRecall, setSavingRecall] = useState(false);

  // General payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
  const [payError, setPayError] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

  // "Add to Bill" prefill from treatment tab
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
      treatmentsApi.forVisit.list(id)
        .then((d) => setTreatments(d.treatments ?? []))
        .catch(() => {});
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
      await visitsApi.update(id, {
        chiefComplaint: notesForm.chiefComplaint || null,
        doctorNotes: notesForm.doctorNotes || null,
        diagnosis: notesForm.diagnosis || null,
      });
      await fetchVisit();
      setEditingNotes(false);
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleSaveRecall(e: React.FormEvent) {
    e.preventDefault();
    setSavingRecall(true);
    setPageError("");
    try {
      await visitsApi.update(id, {
        recallDate: recallForm.recallDate || null,
        recallNotes: recallForm.recallNotes || null,
      });
      await fetchVisit();
      setEditingRecall(false);
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to save recall");
    } finally {
      setSavingRecall(false);
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!visit) return;
    setPayError("");
    setPaySubmitting(true);
    try {
      await visitsApi.payments.add(id, {
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod as "CASH" | "CARD" | "UPI" | "BANK_TRANSFER",
        referenceNumber: payForm.referenceNumber || undefined,
        notes: payForm.notes || undefined,
      });
      setShowPayModal(false);
      setPayForm({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
      await fetchVisit();
    } catch (e) {
      setPayError(e instanceof ApiError ? e.message : "Payment failed");
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handleCompleteVisit() {
    if (!visit) return;
    const due = visit.totalAmount - visit.paidAmount;
    if (due > 0) {
      const confirmed = confirm(
        `This visit has ₹${due.toFixed(2)} outstanding. Mark as complete anyway? Payment can still be recorded after completion.`
      );
      if (!confirmed) return;
    }
    setCompletingVisit(true);
    setPageError("");
    try {
      await visitsApi.update(id, { status: "COMPLETED" });
      await fetchVisit();
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to complete visit");
    } finally {
      setCompletingVisit(false);
    }
  }

  async function handleMarkAppointmentDone() {
    if (!visit?.appointmentId) return;
    setMarkingApptDone(true);
    try {
      await appointmentsApi.updateStatus(visit.appointmentId, "COMPLETED");
      setAppointmentStatus("COMPLETED");
      await fetchVisit();
    } finally {
      setMarkingApptDone(false);
    }
  }

  function handleAddToBill(item: NewItemState) {
    setPrefillItem(item);
    setTab("items");
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">Loading...</div>;
  }
  if (!visit) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-slate-500">{pageError || "Visit not found."}</p>
        <Link href="/dashboard/visits" className="text-blue-600 hover:underline text-sm">Back to Visits</Link>
      </div>
    );
  }

  const due = visit.totalAmount - visit.paidAmount;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={visit.visitCode}
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Visits", href: "/dashboard/visits" },
          { label: visit.visitCode },
        ]}
      />
      <main className="flex-1 p-6 space-y-5">
        {pageError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} className="ml-4 text-red-400 hover:text-red-600 font-bold leading-none">&times;</button>
          </div>
        )}

        {/* Appointment Banner */}
        {visit.appointmentId && appointmentStatus && appointmentStatus !== "COMPLETED" && visit.status !== "COMPLETED" && visit.status !== "CANCELLED" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <span>📅</span>
              <span>This visit is linked to a scheduled appointment.</span>
            </div>
            <button
              onClick={handleMarkAppointmentDone}
              disabled={markingApptDone}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {markingApptDone ? "Marking..." : "Mark Appointment Done"}
            </button>
          </div>
        )}
        {visit.appointmentId && (appointmentStatus === "COMPLETED" || visit.status === "COMPLETED") && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-green-800">
            <span>✅</span>
            <span>Appointment marked as completed.</span>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 font-mono">{visit.visitCode}</h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[visit.status]}`}>
                  {visit.status}
                </span>
                {visit.status !== "CANCELLED" && !editingNotes && (
                  <button
                    onClick={() => { setNotesForm({ chiefComplaint: visit.chiefComplaint || "", doctorNotes: visit.doctorNotes || "", diagnosis: visit.diagnosis || "" }); setEditingNotes(true); }}
                    className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    Edit
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-600">
                <span className="font-medium">{visit.patientName}</span>
                <span className="text-slate-400 ml-1">({visit.patientCode})</span>
                <span className="text-slate-400 mx-2">·</span>
                {formatDoctorName(visit.doctorName)}
                <span className="text-slate-400 mx-2">·</span>
                {visit.visitDate}
              </p>
              {!editingNotes ? (
                <div className="mt-1 space-y-0.5">
                  {visit.chiefComplaint && <p className="text-sm text-slate-500 italic">Chief complaint: {visit.chiefComplaint}</p>}
                  {visit.diagnosis && <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Diagnosis:</span> {visit.diagnosis}</p>}
                  {visit.doctorNotes && <p className="text-sm text-slate-500">Notes: {visit.doctorNotes}</p>}
                </div>
              ) : (
                <form onSubmit={handleSaveNotes} className="mt-2 space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Chief Complaint</label>
                    <input type="text" value={notesForm.chiefComplaint} onChange={e => setNotesForm(f => ({ ...f, chiefComplaint: e.target.value }))} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Diagnosis</label>
                    <input type="text" value={notesForm.diagnosis} onChange={e => setNotesForm(f => ({ ...f, diagnosis: e.target.value }))} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter diagnosis..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Doctor Notes</label>
                    <textarea value={notesForm.doctorNotes} onChange={e => setNotesForm(f => ({ ...f, doctorNotes: e.target.value }))} rows={2} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingNotes} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50">{savingNotes ? "Saving..." : "Save"}</button>
                    <button type="button" onClick={() => setEditingNotes(false)} className="text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-100">Cancel</button>
                  </div>
                </form>
              )}

              {/* Recall */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recall</span>
                  {visit.status !== "CANCELLED" && !editingRecall && (
                    <button
                      onClick={() => { setRecallForm({ recallDate: visit.recallDate || "", recallNotes: visit.recallNotes || "" }); setEditingRecall(true); }}
                      className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      {visit.recallDate ? "Edit" : "Set recall"}
                    </button>
                  )}
                </div>
                {!editingRecall ? (
                  visit.recallDate ? (
                    <div className="text-sm text-slate-700">
                      <span className="font-medium">{visit.recallDate}</span>
                      {visit.recallNotes && <span className="text-slate-500 ml-2">— {visit.recallNotes}</span>}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No recall scheduled</p>
                  )
                ) : (
                  <form onSubmit={handleSaveRecall} className="space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex-1 min-w-36">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Recall Date</label>
                        <input
                          type="date"
                          value={recallForm.recallDate}
                          onChange={e => setRecallForm(f => ({ ...f, recallDate: e.target.value }))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-[2] min-w-48">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                        <input
                          type="text"
                          value={recallForm.recallNotes}
                          onChange={e => setRecallForm(f => ({ ...f, recallNotes: e.target.value }))}
                          placeholder="e.g. 6-month checkup"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingRecall} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50">{savingRecall ? "Saving..." : "Save"}</button>
                      <button type="button" onClick={() => setEditingRecall(false)} className="text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-100">Cancel</button>
                      {visit.recallDate && (
                        <button
                          type="button"
                          onClick={async () => { setSavingRecall(true); await visitsApi.update(id, { recallDate: null, recallNotes: null }).catch(() => {}); await fetchVisit(); setEditingRecall(false); setSavingRecall(false); }}
                          disabled={savingRecall}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1.5 disabled:opacity-50"
                        >
                          Clear recall
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-right">
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="font-semibold text-slate-900">{formatCurrency(visit.totalAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Paid</p>
                    <p className="font-semibold text-green-600">{formatCurrency(visit.paidAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Due</p>
                    <p className={`font-semibold ${due > 0 ? "text-red-600" : "text-slate-400"}`}>
                      {formatCurrency(due)}
                    </p>
                  </div>
                </div>
              </div>
              <Link
                href={`/dashboard/visits/${id}/print`}
                target="_blank"
                className="inline-flex items-center gap-2 border border-slate-200 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </Link>
              {visit.status === "OPEN" && (
                <button
                  onClick={handleCompleteVisit}
                  disabled={completingVisit}
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40 transition"
                >
                  {completingVisit ? "Completing..." : "Complete Visit"}
                </button>
              )}
              {visit.status !== "CANCELLED" && (
                <button
                  onClick={() => router.push(`/dashboard/appointments/new?patientId=${visit.patientId}&doctorId=${visit.doctorId}&type=FOLLOWUP`)}
                  className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                >
                  Book Follow-up
                </button>
              )}
              <button
                onClick={() => setShowPayModal(true)}
                disabled={visit.status === "CANCELLED" || due <= 0}
                className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 flex gap-1 overflow-x-auto">
            {(["items", "payments", "attachments", "history", "treatmentPlan", "chart"] as TabKey[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "items" ? "Items"
                  : t === "treatmentPlan" ? "Treatment Plan"
                  : t === "chart" ? "Dental Chart"
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === "items" && (
              <VisitItemsTab
                key={prefillItem ? JSON.stringify(prefillItem) : "items"}
                visitId={id}
                visitStatus={visit.status}
                items={items}
                treatments={treatments}
                payments={payments}
                prefillItem={prefillItem}
                onRefresh={fetchVisit}
                onPageError={setPageError}
              />
            )}
            {tab === "payments" && (
              <VisitPaymentsTab
                visit={visit}
                payments={payments}
                due={due}
                onOpenPayModal={() => setShowPayModal(true)}
              />
            )}
            {tab === "attachments" && (
              <VisitAttachmentsTab
                visitId={id}
                visitStatus={visit.status}
                attachments={attachments}
                patientId={visit.patientId}
                onRefresh={fetchVisit}
                onPageError={setPageError}
              />
            )}
            {tab === "history" && (
              <VisitHistoryTab
                patientName={visit.patientName ?? ""}
                history={history}
              />
            )}
            {tab === "treatmentPlan" && (
              <VisitTreatmentPlanTab
                visitId={id}
                visit={visit}
                treatments={treatments}
                onRefresh={fetchVisit}
                onPageError={setPageError}
                onAddToBill={handleAddToBill}
              />
            )}
            {tab === "chart" && (
              <VisitToothChartTab
                visitId={id}
                patientId={visit.patientId}
                visitStatus={visit.status}
                items={items}
              />
            )}
          </div>
        </div>
      </main>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Payment</h3>
            <form onSubmit={handleAddPayment} className="space-y-4">
              {payError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{payError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount (max: {formatCurrency(due)}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  max={due}
                  step="0.01"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference Number</label>
                <input
                  value={payForm.referenceNumber}
                  onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="UPI ref / Card last 4..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {paySubmitting ? "Processing..." : "Record Payment"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPayModal(false); setPayError(""); }}
                  className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
