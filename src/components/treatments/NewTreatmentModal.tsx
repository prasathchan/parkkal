"use client";

import { useState, useEffect, useRef } from "react";
import { ToothChart } from "@/components/ui/tooth-chart";
import { patientsApi, orgApi, treatmentsApi, ApiError } from "@/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  name: string;
  patientCode: string;
}

interface Member {
  userId: string;
  name: string;
  role: string;
  isDoctor?: number;
}

interface NewTreatmentForm {
  patientId: string;
  doctorId: string;
  description: string;
  procedure: string;
  toothNumbers: string[];
  cost: string;
}

interface NewTreatmentModalProps {
  currentUserRole: string;
  currentUserId: string;
  currentUserName: string;
  onCreated: () => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewTreatmentModal({
  currentUserRole,
  currentUserId,
  currentUserName,
  onCreated,
  onClose,
}: NewTreatmentModalProps) {
  const [form, setForm] = useState<NewTreatmentForm>({
    patientId: "",
    doctorId: currentUserRole === "DOCTOR" ? currentUserId : "",
    description: "",
    procedure: "",
    toothNumbers: [],
    cost: "0",
  });

  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced patient search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!patientSearch.trim()) { setPatients([]); setShowPatientDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await patientsApi.list({ search: patientSearch });
        setPatients(data.patients || []);
        setShowPatientDropdown(true);
      } catch { /* silently ignore search errors */ }
    }, 300);
  }, [patientSearch]);

  // Load doctor list (non-doctor roles only)
  useEffect(() => {
    if (currentUserRole === "DOCTOR") return;
    orgApi.members.list()
      .then((d) => {
        const all: Member[] = d.members || [];
        setMembers(all.filter((m) => m.role === "DOCTOR" || (m.role === "ADMIN" && m.isDoctor === 1)));
      })
      .catch(() => {});
  }, [currentUserRole]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.doctorId || !form.description.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await treatmentsApi.create({
        patientId: form.patientId,
        doctorId: form.doctorId,
        description: form.description,
        procedure: form.procedure || undefined,
        toothNumbers: form.toothNumbers.length > 0 ? form.toothNumbers.join(",") : undefined,
        cost: parseFloat(form.cost) || 0,
      });
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-pk-surface rounded-pk-xl shadow-pk-e3 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pk-border flex-shrink-0">
          <h2 className="text-base font-semibold text-pk-text">New Treatment Plan</h2>
          <button onClick={onClose} className="text-pk-text-muted hover:text-pk-text-secondary transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Patient */}
          <div>
            <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">
              Patient <span className="text-pk-danger-text">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  if (!e.target.value) setForm((f) => ({ ...f, patientId: "" }));
                }}
                placeholder="Search patient..."
                className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
              />
              {showPatientDropdown && patients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-pk-surface border border-pk-border rounded-pk-sm shadow-pk-e2 z-10">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, patientId: p.id }));
                        setPatientSearch(p.name);
                        setShowPatientDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-pk-surface-raised flex items-center gap-2"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-pk-text-muted">{p.patientCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.patientId && <p className="text-xs text-pk-success-text mt-1">Patient selected</p>}
          </div>

          {/* Doctor */}
          <div>
            <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">
              Doctor {currentUserRole !== "DOCTOR" && <span className="text-pk-danger-text">*</span>}
            </label>
            {currentUserRole === "DOCTOR" ? (
              <p className="w-full px-3 py-2 border border-pk-border rounded-pk-sm text-sm bg-pk-surface-raised text-pk-text-secondary">
                {currentUserName}
              </p>
            ) : (
              <select
                value={form.doctorId}
                onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
              >
                <option value="">Select doctor...</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name} ({m.role})</option>
                ))}
              </select>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">
              Description <span className="text-pk-danger-text">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
              rows={3}
              placeholder="Describe the treatment plan..."
              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none"
            />
          </div>

          {/* Procedure */}
          <div>
            <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Procedure</label>
            <input
              type="text"
              value={form.procedure}
              onChange={(e) => setForm((f) => ({ ...f, procedure: e.target.value }))}
              placeholder="e.g. Root Canal Treatment, Crown Placement"
              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            />
          </div>

          {/* Tooth Numbers */}
          <div>
            <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Tooth Selection (FDI)</label>
            <div className="flex justify-center">
              <ToothChart
                value={form.toothNumbers}
                onChange={(teeth) => setForm((f) => ({ ...f, toothNumbers: teeth }))}
              />
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Cost (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            />
          </div>

          {submitError && (
            <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">
              {submitError}
            </div>
          )}

          <div className="flex gap-3 pt-2 pb-2">
            <button
              type="submit"
              disabled={submitting || !form.patientId || !form.doctorId || !form.description.trim()}
              className="flex-1 bg-pk-teal-600 text-white px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : "Save Treatment Plan"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
