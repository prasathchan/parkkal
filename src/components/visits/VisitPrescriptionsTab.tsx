"use client";

import { useState } from "react";
import { visitsApi, ApiError } from "@/api";
import type { Prescription, Medicine } from "@/types";

interface Props {
  visitId: string;
  visitStatus: string;
  prescriptions: Prescription[];
  onRefresh: () => Promise<void>;
  onPageError: (msg: string) => void;
}

const EMPTY_MEDICINE: Medicine = { name: "", dosage: "", frequency: "", duration: "", notes: "" };
const FREQ_PRESETS = ["1-0-1", "1-1-1", "0-0-1", "1-0-0", "SOS", "BD", "TDS", "OD"];

export function VisitPrescriptionsTab({
  visitId,
  visitStatus,
  prescriptions,
  onRefresh,
  onPageError,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([{ ...EMPTY_MEDICINE }]);
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function addMedicineRow() {
    setMedicines((prev) => [...prev, { ...EMPTY_MEDICINE }]);
  }

  function removeMedicineRow(idx: number) {
    setMedicines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMedicine(idx: number, field: keyof Medicine, value: string) {
    setMedicines((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  function resetForm() {
    setMedicines([{ ...EMPTY_MEDICINE }]);
    setInstructions("");
    setFormError("");
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = medicines.every((m) => m.name.trim() && m.dosage.trim() && m.frequency.trim() && m.duration.trim());
    if (!valid) {
      setFormError("Fill in name, dosage, frequency, and duration for every medicine.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await visitsApi.prescriptions.add(visitId, {
        medicines: medicines.map((m) => ({
          name: m.name.trim(),
          dosage: m.dosage.trim(),
          frequency: m.frequency.trim(),
          duration: m.duration.trim(),
          notes: m.notes?.trim() || undefined,
        })),
        instructions: instructions.trim() || undefined,
      });
      await onRefresh();
      resetForm();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save prescription");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(prescriptionId: string) {
    if (!confirm("Delete this prescription?")) return;
    setDeletingId(prescriptionId);
    try {
      await visitsApi.prescriptions.delete(visitId, prescriptionId);
      await onRefresh();
    } catch (err) {
      onPageError(err instanceof ApiError ? err.message : "Failed to delete prescription");
    } finally {
      setDeletingId(null);
    }
  }

  function handlePrint(rx: Prescription) {
    const lines = rx.medicines.map(
      (m) => `• ${m.name} — ${m.dosage}, ${m.frequency}, ${m.duration}${m.notes ? ` (${m.notes})` : ""}`
    ).join("\n");
    const text = [
      `Prescription — Dr. ${rx.doctorName}`,
      `Date: ${new Date(rx.createdAt).toLocaleDateString("en-IN")}`,
      "",
      lines,
      rx.instructions ? `\nInstructions: ${rx.instructions}` : "",
    ].join("\n");

    const win = window.open("", "_blank", "width=600,height=500");
    if (!win) return;
    win.document.write(`<pre style="font-family:sans-serif;padding:2rem;white-space:pre-wrap">${text}</pre>`);
    win.document.close();
    win.focus();
    win.print();
  }

  const canEdit = visitStatus !== "CANCELLED";

  return (
    <div className="space-y-5">
      {/* Add button */}
      {canEdit && !showForm && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Prescription
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">New Prescription</h3>

          {/* Medicine rows */}
          <div className="space-y-3">
            {medicines.map((med, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Medicine {idx + 1}</span>
                  {medicines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMedicineRow(idx)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Drug name *</label>
                    <input
                      type="text"
                      value={med.name}
                      onChange={(e) => updateMedicine(idx, "name", e.target.value)}
                      placeholder="e.g. Amoxicillin 500mg"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Dosage *</label>
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedicine(idx, "dosage", e.target.value)}
                      placeholder="e.g. 1 tablet"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Frequency *</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={med.frequency}
                        onChange={(e) => updateMedicine(idx, "frequency", e.target.value)}
                        placeholder="e.g. 1-0-1"
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) updateMedicine(idx, "frequency", e.target.value); }}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-500"
                      >
                        <option value="">Preset</option>
                        {FREQ_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Duration *</label>
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) => updateMedicine(idx, "duration", e.target.value)}
                      placeholder="e.g. 5 days"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Notes</label>
                    <input
                      type="text"
                      value={med.notes ?? ""}
                      onChange={(e) => updateMedicine(idx, "notes", e.target.value)}
                      placeholder="e.g. After food"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addMedicineRow}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add another medicine
          </button>

          <div>
            <label className="block text-xs text-slate-500 mb-1">General instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. Avoid hot food for 24 hours"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {formError && <p className="text-red-500 text-xs">{formError}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting ? "Saving…" : "Save Prescription"}
            </button>
          </div>
        </form>
      )}

      {/* Prescription list */}
      {prescriptions.length === 0 && !showForm ? (
        <p className="text-center text-slate-400 text-sm py-6">No prescriptions recorded for this visit</p>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700">Dr. {rx.doctorName}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(rx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint(rx)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(rx.id)}
                      disabled={deletingId === rx.id}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {deletingId === rx.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
                </div>
              </div>

              {/* Medicines table */}
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {rx.medicines.length > 0 && (
                    <div className="px-5 py-1.5 grid grid-cols-4 gap-2 bg-slate-50 border-t border-slate-100">
                      {["Drug", "Dosage", "Frequency", "Duration"].map((h) => (
                        <p key={h} className="text-xs text-slate-400 font-medium">{h}</p>
                      ))}
                    </div>
                  )}
                  <div className="divide-y divide-slate-100">
                    {rx.medicines.map((med, i) => (
                      <div key={i} className="px-5 py-3 grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{med.name}</p>
                          {med.notes && <p className="text-xs text-slate-400">{med.notes}</p>}
                        </div>
                        <p className="text-slate-600">{med.dosage}</p>
                        <p className="text-slate-600">{med.frequency}</p>
                        <p className="text-slate-600">{med.duration}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              {rx.instructions && (
                <div className="px-5 py-3 border-t border-slate-100 bg-amber-50">
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">Instructions: </span>{rx.instructions}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
