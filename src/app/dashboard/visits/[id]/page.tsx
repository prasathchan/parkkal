"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { ToothChart } from "@/components/ui/tooth-chart";

type TabKey = "items" | "payments" | "attachments" | "history" | "treatmentPlan";

interface Visit {
  id: string;
  visitCode: string;
  visitDate: string;
  chiefComplaint?: string | null;
  doctorNotes?: string | null;
  diagnosis?: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  totalAmount: number;
  paidAmount: number;
  appointmentId?: string | null;
  visitType?: string | null;
  patientName: string;
  patientCode: string;
  patientId: string;
  doctorName: string;
  doctorId: string;
}

interface VisitItem {
  id: string;
  itemName: string;
  category: string;
  toothNumber?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  notes?: string | null;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt: number;
  recordedBy: string;
  treatmentId?: string | null;
  treatmentDescription?: string | null;
}

interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: number;
}

interface HistoryVisit {
  id: string;
  visitCode: string;
  visitDate: string;
  doctorName: string;
  totalAmount: number;
  status: string;
}

interface Treatment {
  id: string;
  description: string;
  toothNumbers?: string | null;
  procedure?: string | null;
  cost: number;
  billedAmount?: number; // sum of all visit items linked to this treatment across all visits
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  createdAt: number;
  visitId?: string | null;
  consentStatus: string;
  consentDocumentUrl?: string | null;
  consentDocumentName?: string | null;
  consentUploadedAt?: number | null;
  consentNotes?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const CATEGORIES = ["PROCEDURE", "TREATMENT", "MEDICINE", "XRAY", "CONSULTATION", "OTHER"];
const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [items, setItems] = useState<VisitItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [tab, setTab] = useState<TabKey>("items");
  const [loading, setLoading] = useState(true);

  // Item form
  const [newItem, setNewItem] = useState({ itemName: "", category: "PROCEDURE", toothNumber: "", quantity: "1", unitPrice: "0", notes: "", linkedTreatmentId: "" });
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState("");

  // General payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
  const [payError, setPayError] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Treatment-attributed payment modal
  const [txPayModal, setTxPayModal] = useState<{ treatmentId: string; description: string; cost: number } | null>(null);
  const [txPayForm, setTxPayForm] = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
  const [txPayError, setTxPayError] = useState("");
  const [txPaySubmitting, setTxPaySubmitting] = useState(false);

  // Appointment
  const [markingApptDone, setMarkingApptDone] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);

  // Complete visit
  const [completingVisit, setCompletingVisit] = useState(false);

  // Clinical notes inline edit
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesForm, setNotesForm] = useState({ chiefComplaint: "", doctorNotes: "", diagnosis: "" });
  const [savingNotes, setSavingNotes] = useState(false);

  // Attachment
  const [fileType, setFileType] = useState("OTHER");
  const [uploadError, setUploadError] = useState("");

  // Treatment plan
  const [txForm, setTxForm] = useState({ description: "", toothNumbers: [] as string[], procedure: "", cost: "0" });
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txError, setTxError] = useState("");
  const [txUpdating, setTxUpdating] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkablePlans, setLinkablePlans] = useState<Treatment[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);

  // Consent
  const [consentUploading, setConsentUploading] = useState<string | null>(null);
  const [consentUploadError, setConsentUploadError] = useState<Record<string, string>>({});
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideTxId, setOverrideTxId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState("");
  // IN_PROGRESS warning
  const [pendingStatusChange, setPendingStatusChange] = useState<{ txId: string; status: string } | null>(null);

  // Generic action error (delete / complete / status update)
  const [pageError, setPageError] = useState("");

  const fetchVisit = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/visits/${id}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setVisit(data.visit);
    setItems(data.items || []);
    setPayments(data.payments || []);
    setAttachments(data.attachments || []);
    if (data.visit?.appointmentId) {
      const apptRes = await fetch(`/api/appointments/${data.visit.appointmentId}`);
      if (apptRes.ok) {
        const apptData = await apptRes.json();
        setAppointmentStatus(apptData.appointment?.status || null);
      }
    } else {
      setAppointmentStatus(null);
    }
    const txRes = await fetch(`/api/visits/${id}/treatments`);
    if (txRes.ok) {
      const txData = await txRes.json();
      setTreatments(txData.treatments || []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchVisit(); }, [fetchVisit]);

  useEffect(() => {
    if (visit?.patientId) {
      fetch(`/api/visits?patientId=${visit.patientId}`)
        .then((r) => r.json())
        .then((d) => setHistory((d.visits || []).filter((v: HistoryVisit) => v.id !== id)));
    }
  }, [visit?.patientId, id]);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setAddingItem(true);
    setAddItemError("");
    try {
      const res = await fetch(`/api/visits/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItem,
          quantity: Number(newItem.quantity),
          unitPrice: Number(newItem.unitPrice),
        }),
      });
      if (res.ok) {
        setNewItem({ itemName: "", category: "PROCEDURE", toothNumber: "", quantity: "1", unitPrice: "0", notes: "", linkedTreatmentId: "" });
        await fetchVisit();
      } else {
        const d = await res.json().catch(() => ({}));
        setAddItemError((d as { error?: string }).error || "Failed to add item");
      }
    } catch {
      setAddItemError("Network error. Please try again.");
    } finally {
      setAddingItem(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("Delete this item?")) return;
    setPageError("");
    const res = await fetch(`/api/visits/${id}/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPageError(d.error || "Failed to delete item");
      return;
    }
    await fetchVisit();
  }

  async function handleSaveNotes(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotes(true);
    setPageError("");
    const res = await fetch(`/api/visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chiefComplaint: notesForm.chiefComplaint || null,
        doctorNotes: notesForm.doctorNotes || null,
        diagnosis: notesForm.diagnosis || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPageError(d.error || "Failed to save notes");
      setSavingNotes(false);
      return;
    }
    await fetchVisit();
    setEditingNotes(false);
    setSavingNotes(false);
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    setPayError("");
    setPaySubmitting(true);
    const res = await fetch(`/api/visits/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber || null,
        notes: payForm.notes || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPayError(data.error || "Payment failed");
      setPaySubmitting(false);
      return;
    }
    setShowPayModal(false);
    setPayForm({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
    await fetchVisit();
    setPaySubmitting(false);
  }

  async function handleAddTreatmentPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!txPayModal) return;
    setTxPayError("");
    setTxPaySubmitting(true);
    const res = await fetch(`/api/visits/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(txPayForm.amount),
        paymentMethod: txPayForm.paymentMethod,
        referenceNumber: txPayForm.referenceNumber || null,
        notes: txPayForm.notes || null,
        treatmentId: txPayModal.treatmentId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTxPayError(data.error || "Payment failed");
      setTxPaySubmitting(false);
      return;
    }
    setTxPayModal(null);
    setTxPayForm({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
    await fetchVisit();
    setTxPaySubmitting(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !visit) return;
    setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("fileType", fileType);
    fd.append("patientId", visit.patientId);
    const res = await fetch(`/api/visits/${id}/attachments`, { method: "POST", body: fd });
    if (!res.ok) {
      const d = await res.json();
      setUploadError(d.error || "Upload failed");
      return;
    }
    await fetchVisit();
    e.target.value = "";
  }

  async function handleDeleteAttachment(attId: string) {
    if (!confirm("Delete this attachment?")) return;
    setPageError("");
    const res = await fetch(`/api/visits/${id}/attachments/${attId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPageError(d.error || "Failed to delete attachment");
      return;
    }
    await fetchVisit();
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
    const res = await fetch(`/api/visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPageError(d.error || "Failed to complete visit");
      setCompletingVisit(false);
      return;
    }
    await fetchVisit();
    setCompletingVisit(false);
  }

  async function handleAddTreatment(e: React.FormEvent) {
    e.preventDefault();
    if (!visit) return;
    setTxSubmitting(true);
    setTxError("");
    try {
      const res = await fetch(`/api/visits/${id}/treatments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: txForm.description,
          toothNumbers: txForm.toothNumbers.length > 0 ? txForm.toothNumbers.join(",") : undefined,
          procedure: txForm.procedure || undefined,
          cost: Number(txForm.cost),
        }),
      });
      if (res.ok) {
        setTxForm({ description: "", toothNumbers: [], procedure: "", cost: "0" });
        await fetchVisit();
      } else {
        const d = await res.json().catch(() => ({}));
        setTxError((d as { error?: string }).error || "Failed to add treatment");
      }
    } catch {
      setTxError("Network error. Please try again.");
    } finally {
      setTxSubmitting(false);
    }
  }

  async function handleUpdateTreatmentStatus(txId: string, status: string) {
    setTxUpdating(txId);
    setPageError("");
    const res = await fetch(`/api/treatments/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPageError(d.error || "Failed to update treatment status");
    } else {
      await fetchVisit();
    }
    setTxUpdating(null);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleDeleteTreatment(txId: string) {
    if (!confirm("Delete this treatment?")) return;
    setPageError("");
    const res = await fetch(`/api/treatments/${txId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPageError(d.error || "Failed to delete treatment");
      return;
    }
    await fetchVisit();
  }

  async function handleConsentUpload(txId: string, file: File) {
    setConsentUploading(txId);
    setConsentUploadError(prev => ({ ...prev, [txId]: "" }));
    const fd = new FormData();
    fd.append("document", file);
    const res = await fetch(`/api/treatments/${txId}/consent/upload`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setConsentUploadError(prev => ({ ...prev, [txId]: data.error || "Upload failed" }));
    } else {
      await fetchVisit();
    }
    setConsentUploading(null);
  }

  async function handleEmergencyOverride() {
    if (!overrideTxId) return;
    setOverrideSubmitting(true);
    setOverrideError("");
    const res = await fetch(`/api/treatments/${overrideTxId}/consent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: overrideReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setOverrideError(data.error || "Override failed");
      setOverrideSubmitting(false);
      return;
    }
    setShowOverrideModal(false);
    setOverrideTxId(null);
    setOverrideReason("");
    setOverrideSubmitting(false);
    await fetchVisit();
  }

  function handleTreatmentStatusChange(tx: Treatment, newStatus: string) {
    const needsConsent = newStatus === "IN_PROGRESS" && !["VERIFIED", "EMERGENCY_OVERRIDE"].includes(tx.consentStatus);
    if (needsConsent) {
      setPendingStatusChange({ txId: tx.id, status: newStatus });
    } else {
      handleUpdateTreatmentStatus(tx.id, newStatus);
    }
  }

  async function handleOpenLinkModal() {
    if (!visit) return;
    setLinkLoading(true);
    setShowLinkModal(true);
    const res = await fetch(`/api/treatments?patientId=${visit.patientId}`);
    if (res.ok) {
      const d = await res.json();
      // Only show plans that aren't already linked to any visit
      // Show all the patient's treatment plans except those already linked to this visit
      const linkedIds = new Set(treatments.map(t => t.id));
      setLinkablePlans((d.treatments || []).filter((t: Treatment) => !linkedIds.has(t.id)));
    }
    setLinkLoading(false);
  }

  async function handleLinkPlan(txId: string) {
    await fetch(`/api/visits/${id}/treatments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treatmentId: txId }),
    });
    setShowLinkModal(false);
    await fetchVisit();
  }

  async function handleUnlinkTreatment(txId: string) {
    if (!confirm("Unlink this treatment plan from this visit? The plan itself will not be deleted.")) return;
    setPageError("");
    const res = await fetch(`/api/visits/${id}/treatments?treatmentId=${txId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPageError(d.error || "Failed to unlink treatment");
      return;
    }
    await fetchVisit();
  }

  async function handleMarkAppointmentDone() {
    if (!visit?.appointmentId) return;
    setMarkingApptDone(true);
    await fetch(`/api/appointments/${visit.appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    setAppointmentStatus("COMPLETED");
    await fetchVisit();
    setMarkingApptDone(false);
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">Loading...</div>;
  }
  if (!visit) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-slate-500">Visit not found.</p>
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
            {(["items", "payments", "attachments", "history", "treatmentPlan"] as TabKey[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "items" ? "Items"
                  : t === "treatmentPlan" ? "🦷 Treatment Plan"
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Tab: Items */}
            {tab === "items" && (
              <div className="space-y-5">
                {/* Add Item Form */}
                {visit.status !== "CANCELLED" && (
                  <form onSubmit={handleAddItem} className="bg-slate-50 rounded-lg p-4">
                    {visit.status === "COMPLETED" && (
                      <p className="text-xs text-amber-600 mb-2">⚠️ Visit is completed — items added will update billing.</p>
                    )}
                    <p className="text-sm font-semibold text-slate-700 mb-3">Add Item</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="lg:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Item Name *</label>
                        <input
                          required
                          value={newItem.itemName}
                          onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Medicine / Procedure..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Category</label>
                        <select
                          value={newItem.category}
                          onChange={(e) => {
                            const cat = e.target.value;
                            setNewItem({ itemName: "", category: cat, toothNumber: "", quantity: "1", unitPrice: "0", notes: "", linkedTreatmentId: "" });
                          }}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c === "TREATMENT" ? "Treatment Plan" : c}</option>
                          ))}
                        </select>
                      </div>
                      {/* Treatment picker — shown only when TREATMENT category is selected */}
                      {newItem.category === "TREATMENT" && (
                        <div className="col-span-full">
                          <label className="block text-xs text-slate-500 mb-1">Select Treatment Plan *</label>
                          {treatments.length === 0 ? (
                            <p className="text-xs text-amber-600 mt-1">No treatment plans linked to this visit. Add one in the Treatment Plan tab first.</p>
                          ) : (
                            <select
                              value={newItem.linkedTreatmentId}
                              onChange={(e) => {
                                const tx = treatments.find(t => t.id === e.target.value);
                                if (!tx) {
                                  setNewItem(n => ({ ...n, linkedTreatmentId: "", itemName: "", unitPrice: "0", toothNumber: "" }));
                                  return;
                                }
                                const firstTooth = tx.toothNumbers ? tx.toothNumbers.split(",")[0].trim() : "";
                                setNewItem(n => ({
                                  ...n,
                                  linkedTreatmentId: tx.id,
                                  itemName: tx.description,
                                  unitPrice: String(tx.cost),
                                  toothNumber: firstTooth,
                                }));
                              }}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">— Pick a treatment plan —</option>
                              {treatments.map(tx => (
                                <option key={tx.id} value={tx.id}>
                                  {tx.description}{tx.toothNumbers ? ` (Tooth ${tx.toothNumbers})` : ""} — Est. ₹{tx.cost.toLocaleString("en-IN")}
                                </option>
                              ))}
                            </select>
                          )}
                          {newItem.linkedTreatmentId && (
                            <p className="text-xs text-slate-400 mt-1">
                              Estimated cost pre-filled. Edit the Unit Price below to match what the patient agreed to pay.
                            </p>
                          )}
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Tooth #</label>
                        <select
                          value={newItem.toothNumber}
                          onChange={(e) => setNewItem({ ...newItem, toothNumber: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— Any tooth</option>
                          <optgroup label="Upper Right">
                            {[11,12,13,14,15,16,17,18].map(n => <option key={n} value={String(n)}>{n}</option>)}
                          </optgroup>
                          <optgroup label="Upper Left">
                            {[21,22,23,24,25,26,27,28].map(n => <option key={n} value={String(n)}>{n}</option>)}
                          </optgroup>
                          <optgroup label="Lower Left">
                            {[31,32,33,34,35,36,37,38].map(n => <option key={n} value={String(n)}>{n}</option>)}
                          </optgroup>
                          <optgroup label="Lower Right">
                            {[41,42,43,44,45,46,47,48].map(n => <option key={n} value={String(n)}>{n}</option>)}
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Qty</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Unit Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newItem.unitPrice}
                          onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Notes</label>
                        <input
                          value={newItem.notes}
                          onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional notes..."
                        />
                      </div>
                      <div className="pt-5">
                        <p className="text-sm font-semibold text-slate-700">
                          = {formatCurrency(Number(newItem.quantity) * Number(newItem.unitPrice))}
                        </p>
                      </div>
                      <div className="pt-5 flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={addingItem}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {addingItem ? "Adding..." : "Add"}
                        </button>
                        {addItemError && (
                          <p className="text-xs text-red-600">{addItemError}</p>
                        )}
                      </div>
                    </div>
                  </form>
                )}

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Item</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Category</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Tooth</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">Qty</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">Unit Price</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
                        {visit.status !== "CANCELLED" && <th className="px-3 py-2"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400">No items added yet</td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-slate-900">{item.itemName}</div>
                              {item.notes && <div className="text-xs text-slate-400">{item.notes}</div>}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{item.category}</span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{item.toothNumber || "—"}</td>
                            <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(item.amount)}</td>
                            {visit.status !== "CANCELLED" && (
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                    {items.length > 0 && (
                      <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-right font-semibold text-slate-700">Subtotal</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">
                            {formatCurrency(items.reduce((sum, i) => sum + i.amount, 0))}
                          </td>
                          {visit.status !== "CANCELLED" && <td />}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* Tab: Payments */}
            {tab === "payments" && (
              <div className="space-y-5">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Bill</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(visit.totalAmount)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Paid</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(visit.paidAmount)}</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${due > 0 ? "bg-red-50" : "bg-slate-50"}`}>
                    <p className="text-xs text-slate-500 mb-1">Balance Due</p>
                    <p className={`text-lg font-bold ${due > 0 ? "text-red-600" : "text-slate-400"}`}>{formatCurrency(due)}</p>
                  </div>
                </div>

                {/* Payments History */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">For</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Method</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Reference</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-400">No payments recorded yet</td>
                        </tr>
                      ) : (
                        payments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{new Date(p.paidAt).toLocaleString("en-IN")}</td>
                            <td className="px-3 py-2.5">
                              {p.treatmentId ? (
                                <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                                  🦷 {p.treatmentDescription ?? "Treatment Plan"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                  General
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-green-700">{formatCurrency(p.amount)}</td>
                            <td className="px-3 py-2.5">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{p.paymentMethod}</span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{p.referenceNumber || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-500">{p.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {visit.status === "OPEN" && due > 0 && (
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
                  >
                    + Add Payment
                  </button>
                )}
              </div>
            )}

            {/* Tab: Attachments */}
            {tab === "attachments" && (
              <div className="space-y-5">
                {/* Upload */}
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                  <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-slate-500 mb-3">Click to upload or drag & drop files</p>
                  <div className="flex items-center justify-center gap-3">
                    <select
                      value={fileType}
                      onChange={(e) => setFileType(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="XRAY">X-Ray</option>
                      <option value="PRESCRIPTION">Prescription</option>
                      <option value="DOCTOR_NOTE">Doctor Note</option>
                      <option value="LAB_REPORT">Lab Report</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                      Browse File
                      <input type="file" className="hidden" onChange={handleUpload} />
                    </label>
                  </div>
                  {uploadError && <p className="text-red-500 text-xs mt-2">{uploadError}</p>}
                </div>

                {/* Attachments Grid */}
                {attachments.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-4">No attachments yet</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {attachments.map((att) => (
                      <div key={att.id} className="border border-slate-200 rounded-xl p-3 text-center relative group">
                        {att.mimeType.startsWith("image/") ? (
                          <a href={att.fileUrl} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={att.fileUrl} alt={att.originalName} className="w-full h-24 object-cover rounded-lg mb-2" />
                          </a>
                        ) : (
                          <div className="w-full h-24 bg-slate-100 rounded-lg flex items-center justify-center mb-2">
                            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                        <p className="text-xs font-medium text-slate-700 truncate">{att.originalName}</p>
                        <p className="text-xs text-slate-400">{att.fileType} · {formatBytes(att.fileSize)}</p>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full text-xs hover:bg-red-200 transition"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: History */}
            {tab === "history" && (
              <div>
                <p className="text-sm text-slate-500 mb-4">
                  All visits for <span className="font-semibold text-slate-700">{visit.patientName}</span>
                </p>
                {history.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-6">No other visits</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <Link
                        key={h.id}
                        href={`/dashboard/visits/${h.id}`}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition"
                      >
                        <div>
                          <p className="text-sm font-mono text-blue-700">{h.visitCode}</p>
                          <p className="text-xs text-slate-500">{h.visitDate} · {formatDoctorName(h.doctorName)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(h.totalAmount)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.status] || "bg-slate-100 text-slate-600"}`}>
                            {h.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Treatment Plan */}
            {tab === "treatmentPlan" && (
              <div className="space-y-5">
                {visit.status !== "CANCELLED" && (
                  <form onSubmit={handleAddTreatment} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Add Treatment Item</p>
                      <button
                        type="button"
                        onClick={handleOpenLinkModal}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + Link Existing Plan
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Description *</label>
                        <input
                          required
                          value={txForm.description}
                          onChange={(e) => setTxForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="e.g. Root Canal Treatment"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Est. Cost (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={txForm.cost}
                          onChange={(e) => setTxForm(f => ({ ...f, cost: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-2">Tooth Selection (FDI)</label>
                      <ToothChart
                        value={txForm.toothNumbers}
                        onChange={(teeth) => setTxForm(f => ({ ...f, toothNumbers: teeth }))}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Procedure Notes</label>
                        <input
                          value={txForm.procedure}
                          onChange={(e) => setTxForm(f => ({ ...f, procedure: e.target.value }))}
                          placeholder="Optional procedure details..."
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="pt-5 flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={txSubmitting}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {txSubmitting ? "Adding..." : "Add"}
                        </button>
                        {txError && <p className="text-xs text-red-600">{txError}</p>}
                      </div>
                    </div>
                  </form>
                )}

                {treatments.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-6">No treatment items yet</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {treatments.map((tx) => {
                        const consentBadge: Record<string, string> = {
                          PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
                          UPLOADED: "bg-blue-50 text-blue-700 border-blue-200",
                          VERIFIED: "bg-green-50 text-green-700 border-green-200",
                          REJECTED: "bg-red-50 text-red-700 border-red-200",
                          EMERGENCY_OVERRIDE: "bg-orange-50 text-orange-700 border-orange-200",
                        };
                        const consentLabel: Record<string, string> = {
                          PENDING: "⚠ Consent Pending",
                          UPLOADED: "⏳ Awaiting Verification",
                          VERIFIED: "✓ Consent Verified",
                          REJECTED: "✗ Consent Rejected",
                          EMERGENCY_OVERRIDE: "⚡ Emergency Override",
                        };
                        // billedAmount = SUM of visit items linked to this treatment across ALL visits
                        const txPaid = tx.billedAmount ?? 0;
                        const txOutstanding = Math.max(0, tx.cost - txPaid);
                        return (
                        <div key={tx.id} className={`border rounded-xl p-4 transition ${tx.status === "COMPLETED" ? "bg-slate-50 border-slate-200 opacity-75" : "bg-white border-slate-200"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`text-sm font-semibold ${tx.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-900"}`}>{tx.description}</p>
                                {tx.toothNumbers && (
                                  <ToothChart
                                    value={tx.toothNumbers.split(",").map(s => s.trim()).filter(Boolean)}
                                    readOnly
                                    compact
                                  />
                                )}
                              </div>
                              {tx.procedure && <p className="text-xs text-slate-500 mt-0.5">{tx.procedure}</p>}
                              {/* Financial mini-summary for this treatment plan */}
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className="text-sm font-medium text-slate-700">Cost: {formatCurrency(tx.cost)}</span>
                                <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Paid: {formatCurrency(txPaid)}</span>
                                {txOutstanding > 0 && (
                                  <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Due: {formatCurrency(txOutstanding)}</span>
                                )}
                                {txOutstanding === 0 && txPaid > 0 && (
                                  <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">✓ Settled</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                              {visit.status !== "CANCELLED" && (
                                <button
                                  onClick={() => {
                                    const firstTooth = tx.toothNumbers ? tx.toothNumbers.split(",")[0].trim() : "";
                                    setNewItem({
                                      itemName: tx.description,
                                      category: "TREATMENT",
                                      toothNumber: firstTooth,
                                      quantity: "1",
                                      unitPrice: String(tx.cost),
                                      notes: "",
                                      linkedTreatmentId: tx.id,
                                    });
                                    setTab("items");
                                  }}
                                  className="text-xs bg-purple-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-purple-700 transition font-medium"
                                >
                                  Add to Bill
                                </button>
                              )}
                              <select
                                value={tx.status}
                                disabled={txUpdating === tx.id}
                                onChange={(e) => handleTreatmentStatusChange(tx, e.target.value)}
                                className={`text-xs border rounded-lg px-2 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                                  tx.status === "PLANNED" ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                                  : tx.status === "IN_PROGRESS" ? "bg-blue-50 border-blue-200 text-blue-800"
                                  : "bg-green-50 border-green-200 text-green-800"
                                }`}
                              >
                                <option value="PLANNED">Planned</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                              {visit.status !== "CANCELLED" && (
                                <button
                                  onClick={() => handleUnlinkTreatment(tx.id)}
                                  className="text-xs text-slate-400 hover:text-red-600"
                                  title="Unlink from this visit"
                                >
                                  Unlink
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Consent row */}
                          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${consentBadge[tx.consentStatus] ?? consentBadge.PENDING}`}>
                              {consentLabel[tx.consentStatus] ?? tx.consentStatus}
                            </span>
                            {tx.consentNotes && (
                              <span className="text-xs text-slate-400 italic">{tx.consentNotes}</span>
                            )}
                            {tx.consentDocumentUrl && (
                              <a href={tx.consentDocumentUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                                View document
                              </a>
                            )}
                            <div className="flex items-center gap-2 ml-auto flex-wrap">
                              <a
                                href="/dashboard/treatments/consent"
                                target="_blank"
                                className="text-xs text-slate-500 hover:text-blue-600"
                              >
                                Print Form
                              </a>
                              {tx.consentStatus !== "VERIFIED" && tx.consentStatus !== "EMERGENCY_OVERRIDE" && (
                                <label className={`text-xs px-2 py-1 rounded-lg font-medium cursor-pointer transition ${consentUploading === tx.id ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
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
                                className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                              >
                                Emergency Override
                              </button>
                            </div>
                            {consentUploadError[tx.id] && (
                              <p className="w-full text-xs text-red-600 mt-1">{consentUploadError[tx.id]}</p>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-sm">
                      <span className="text-slate-500">
                        {treatments.filter(t => t.status === "COMPLETED").length} of {treatments.length} completed
                      </span>
                      <span className="font-semibold text-slate-700">
                        Est. total: {formatCurrency(treatments.reduce((s, t) => s + t.cost, 0))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Treatment Payment Modal */}
      {txPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Record Treatment Payment</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                For: <span className="font-medium text-purple-700">🦷 {txPayModal.description}</span>
              </p>
            </div>
            {txPayError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{txPayError}</div>
            )}
            <form onSubmit={handleAddTreatmentPayment} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={txPayForm.amount}
                  onChange={(e) => setTxPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select
                  value={txPayForm.paymentMethod}
                  onChange={(e) => setTxPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference No.</label>
                <input
                  value={txPayForm.referenceNumber}
                  onChange={(e) => setTxPayForm(f => ({ ...f, referenceNumber: e.target.value }))}
                  placeholder="Optional"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={txPaySubmitting}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  {txPaySubmitting ? "Saving..." : "Confirm Payment"}
                </button>
                <button
                  type="button"
                  onClick={() => setTxPayModal(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Link Existing Treatment Plan</h3>
              <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {linkLoading ? (
                <p className="text-sm text-slate-500 text-center py-6">Loading...</p>
              ) : linkablePlans.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No treatment plans found for this patient. Create one from the Treatment Plans page first.</p>
              ) : (
                linkablePlans.map(plan => (
                  <div key={plan.id} className="border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{plan.description}</p>
                      {plan.procedure && <p className="text-xs text-slate-500 mt-0.5">{plan.procedure}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${plan.status === "PLANNED" ? "bg-yellow-50 text-yellow-700" : plan.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                          {plan.status === "IN_PROGRESS" ? "In Progress" : plan.status.charAt(0) + plan.status.slice(1).toLowerCase()}
                        </span>
                        <span className="text-xs text-slate-500">{formatCurrency(plan.cost)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLinkPlan(plan.id)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium flex-shrink-0"
                    >
                      Link
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Emergency Override</h3>
            <p className="text-sm text-slate-500 mb-4">Record a clinical reason to proceed without a signed consent form.</p>
            {overrideError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{overrideError}</div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason <span className="text-red-500">*</span></label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="Describe the clinical reason for proceeding without consent (min 5 characters)..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEmergencyOverride}
                disabled={overrideSubmitting || overrideReason.trim().length < 5}
                className="flex-1 bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition"
              >
                {overrideSubmitting ? "Saving..." : "Apply Override"}
              </button>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">⚠️ Consent Not Verified</h3>
            <p className="text-sm text-slate-600 mb-4">
              This treatment does not have a verified consent form. Starting treatment without consent may have legal and clinical implications.
            </p>
            <p className="text-sm text-slate-600 mb-6">Do you want to proceed anyway or apply an emergency override?</p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => {
                  handleUpdateTreatmentStatus(pendingStatusChange.txId, pendingStatusChange.status);
                  setPendingStatusChange(null);
                }}
                className="flex-1 bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
              >
                Proceed Anyway
              </button>
              <button
                onClick={() => {
                  const tx = treatments.find(t => t.id === pendingStatusChange.txId);
                  if (tx) { setOverrideTxId(tx.id); setOverrideReason(""); setOverrideError(""); setShowOverrideModal(true); }
                  setPendingStatusChange(null);
                }}
                className="flex-1 bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-700 transition"
              >
                Emergency Override
              </button>
              <button
                onClick={() => setPendingStatusChange(null)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
