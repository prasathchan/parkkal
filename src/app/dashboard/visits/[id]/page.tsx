"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDoctorName } from "@/lib/utils";

type TabKey = "items" | "payments" | "attachments" | "history" | "prescriptions";

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

interface Prescription {
  id: string;
  medicines: string; // JSON string
  instructions?: string | null;
  createdAt: number;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const CATEGORIES = ["PROCEDURE", "XRAY", "CONSULTATION", "OTHER"];
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
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [tab, setTab] = useState<TabKey>("items");
  const [loading, setLoading] = useState(true);

  // Item form
  const [newItem, setNewItem] = useState({ itemName: "", category: "PROCEDURE", toothNumber: "", quantity: "1", unitPrice: "0", notes: "" });
  const [addingItem, setAddingItem] = useState(false);

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
  const [payError, setPayError] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Appointment
  const [markingApptDone, setMarkingApptDone] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);

  // Complete visit
  const [completingVisit, setCompletingVisit] = useState(false);

  // Clinical notes inline edit
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesForm, setNotesForm] = useState({ chiefComplaint: "", doctorNotes: "", diagnosis: "" });
  const [savingNotes, setSavingNotes] = useState(false);

  // Prescription form
  const [showRxForm, setShowRxForm] = useState(false);
  const [rxMedicines, setRxMedicines] = useState([{ name: "", dosage: "", frequency: "", duration: "", notes: "" }]);
  const [rxInstructions, setRxInstructions] = useState("");
  const [rxSubmitting, setRxSubmitting] = useState(false);

  // Attachment
  const [fileType, setFileType] = useState("OTHER");
  const [uploadError, setUploadError] = useState("");

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
    const rxRes = await fetch(`/api/visits/${id}/prescriptions`);
    if (rxRes.ok) {
      const rxData = await rxRes.json();
      setPrescriptions(rxData.prescriptions || []);
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
      setNewItem({ itemName: "", category: "PROCEDURE", toothNumber: "", quantity: "1", unitPrice: "0", notes: "" });
      await fetchVisit();
    }
    setAddingItem(false);
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/visits/${id}/items/${itemId}`, { method: "DELETE" });
    await fetchVisit();
  }

  async function handleSaveNotes(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotes(true);
    await fetch(`/api/visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chiefComplaint: notesForm.chiefComplaint || null,
        doctorNotes: notesForm.doctorNotes || null,
        diagnosis: notesForm.diagnosis || null,
      }),
    });
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
        patientId: visit?.patientId,
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
    await fetch(`/api/visits/${id}/attachments/${attId}`, { method: "DELETE" });
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
    await fetch(`/api/visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    await fetchVisit();
    setCompletingVisit(false);
  }

  async function handleAddRx(e: React.FormEvent) {
    e.preventDefault();
    if (!visit) return;
    setRxSubmitting(true);
    const res = await fetch(`/api/visits/${id}/prescriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicines: rxMedicines.filter(m => m.name && m.dosage && m.frequency && m.duration),
        instructions: rxInstructions || null,
        patientId: visit.patientId,
        doctorId: visit.doctorId,
      }),
    });
    if (res.ok) {
      setShowRxForm(false);
      setRxMedicines([{ name: "", dosage: "", frequency: "", duration: "", notes: "" }]);
      setRxInstructions("");
      await fetchVisit();
    }
    setRxSubmitting(false);
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
        {/* Appointment Banner */}
        {visit.appointmentId && appointmentStatus && appointmentStatus !== "COMPLETED" && (
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
        {visit.appointmentId && appointmentStatus === "COMPLETED" && (
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
                <div className="flex items-start gap-2 mt-1">
                  <div className="flex-1 space-y-0.5">
                    {visit.chiefComplaint && <p className="text-sm text-slate-500 italic">Chief complaint: {visit.chiefComplaint}</p>}
                    {visit.diagnosis && <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Diagnosis:</span> {visit.diagnosis}</p>}
                    {visit.doctorNotes && <p className="text-sm text-slate-500">Notes: {visit.doctorNotes}</p>}
                  </div>
                  {visit.status !== "CANCELLED" && (
                    <button
                      onClick={() => { setNotesForm({ chiefComplaint: visit.chiefComplaint || "", doctorNotes: visit.doctorNotes || "", diagnosis: visit.diagnosis || "" }); setEditingNotes(true); }}
                      className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 flex-shrink-0 mt-0.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      Edit
                    </button>
                  )}
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
              {appointmentStatus === "COMPLETED" && (
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
          <div className="border-b border-slate-100 px-6 flex gap-1">
            {(["items", "payments", "attachments", "history", "prescriptions"] as TabKey[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 capitalize transition-colors ${
                  tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "items" ? "Items" : t === "prescriptions" ? "💊 Prescriptions" : t.charAt(0).toUpperCase() + t.slice(1)}
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
                          onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
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
                      <div className="pt-5">
                        <button
                          type="submit"
                          disabled={addingItem}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {addingItem ? "Adding..." : "Add"}
                        </button>
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
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Method</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Reference</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-slate-400">No payments recorded yet</td>
                        </tr>
                      ) : (
                        payments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5">{new Date(p.paidAt).toLocaleString("en-IN")}</td>
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

            {/* Tab: Prescriptions */}
            {tab === "prescriptions" && (
              <div className="space-y-5">
                {visit.status === "OPEN" && !showRxForm && (
                  <button
                    onClick={() => setShowRxForm(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    + New Prescription
                  </button>
                )}

                {showRxForm && (
                  <form onSubmit={handleAddRx} className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50">
                    <p className="text-sm font-semibold text-slate-700">New Prescription</p>

                    <div className="space-y-3">
                      {rxMedicines.map((med, idx) => (
                        <div key={idx} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                          <div className="sm:col-span-1">
                            <label className="block text-xs text-slate-500 mb-1">Drug Name *</label>
                            <input
                              required
                              value={med.name}
                              onChange={(e) => {
                                const updated = [...rxMedicines];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setRxMedicines(updated);
                              }}
                              placeholder="e.g. Amoxicillin"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Dosage *</label>
                            <input
                              required
                              value={med.dosage}
                              onChange={(e) => {
                                const updated = [...rxMedicines];
                                updated[idx] = { ...updated[idx], dosage: e.target.value };
                                setRxMedicines(updated);
                              }}
                              placeholder="e.g. 500mg"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Frequency *</label>
                            <select
                              required
                              value={med.frequency}
                              onChange={(e) => {
                                const updated = [...rxMedicines];
                                updated[idx] = { ...updated[idx], frequency: e.target.value };
                                setRxMedicines(updated);
                              }}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select...</option>
                              <option value="Once daily">Once daily</option>
                              <option value="Twice daily">Twice daily</option>
                              <option value="Three times daily">Three times daily</option>
                              <option value="Four times daily">Four times daily</option>
                              <option value="As needed">As needed</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Duration *</label>
                            <input
                              required
                              value={med.duration}
                              onChange={(e) => {
                                const updated = [...rxMedicines];
                                updated[idx] = { ...updated[idx], duration: e.target.value };
                                setRxMedicines(updated);
                              }}
                              placeholder="e.g. 5 days"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="block text-xs text-slate-500 mb-1">Notes</label>
                              <input
                                value={med.notes}
                                onChange={(e) => {
                                  const updated = [...rxMedicines];
                                  updated[idx] = { ...updated[idx], notes: e.target.value };
                                  setRxMedicines(updated);
                                }}
                                placeholder="Optional"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            {rxMedicines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setRxMedicines(rxMedicines.filter((_, i) => i !== idx))}
                                className="mb-0.5 text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-2 rounded-lg hover:bg-red-50 transition"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setRxMedicines([...rxMedicines, { name: "", dosage: "", frequency: "", duration: "", notes: "" }])}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Add Medicine
                    </button>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Instructions</label>
                      <textarea
                        value={rxInstructions}
                        onChange={(e) => setRxInstructions(e.target.value)}
                        rows={3}
                        placeholder="Additional instructions for the patient..."
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={rxSubmitting}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {rxSubmitting ? "Saving..." : "Save Prescription"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRxForm(false);
                          setRxMedicines([{ name: "", dosage: "", frequency: "", duration: "", notes: "" }]);
                          setRxInstructions("");
                        }}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {prescriptions.length === 0 && !showRxForm ? (
                  <p className="text-center text-slate-400 text-sm py-6">No prescriptions yet</p>
                ) : (
                  <div className="space-y-4">
                    {prescriptions.map((rx) => {
                      const meds = (() => {
                        try { return JSON.parse(rx.medicines) as Array<{ name: string; dosage: string; frequency: string; duration: string; notes?: string }>; }
                        catch { return []; }
                      })();
                      return (
                        <div key={rx.id} className="border border-slate-200 rounded-xl p-5 space-y-3 bg-white">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-700">
                              {new Date(rx.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </p>
                            <Link
                              href={`/dashboard/visits/${id}/print`}
                              target="_blank"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              🖨 Print
                            </Link>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Drug</th>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Dosage</th>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Frequency</th>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Duration</th>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {meds.map((m, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-medium text-slate-900">{m.name}</td>
                                    <td className="px-3 py-2 text-slate-700">{m.dosage}</td>
                                    <td className="px-3 py-2 text-slate-700">{m.frequency}</td>
                                    <td className="px-3 py-2 text-slate-700">{m.duration}</td>
                                    <td className="px-3 py-2 text-slate-500">{m.notes || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {rx.instructions && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                              <p className="text-xs font-semibold text-amber-700 mb-1">Instructions</p>
                              <p className="text-sm text-amber-900">{rx.instructions}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
