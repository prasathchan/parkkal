"use client";

import { useState, useEffect, useRef } from "react";
import { formatDoctorName } from "@/lib/utils";
import { useToast } from "@/context/toast-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { appointmentsApi, patientsApi, orgApi, authApi, locationsApi, ApiError } from "@/api";
import { useLocation } from "@/context/location-context";

interface Patient { id: string; patientCode: string; name: string; }
interface Doctor  { id: string; name: string; role: string; }

export interface NewAppointmentPrefill {
  date?:          string;
  time?:          string;
  patientId?:     string;
  doctorId?:      string;
  type?:          string;
  notes?:         string;
  recallVisitId?: string;
}

interface Props {
  prefill?:    NewAppointmentPrefill;
  onSuccess:   () => void;
  onClose:     () => void;
}

export function NewAppointmentModal({ prefill, onSuccess, onClose }: Props) {
  const { toast }                               = useToast();
  const { selectedLocationId, selectedLocation } = useLocation();
  const initApplied                             = useRef(false);

  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [patients, setPatients]           = useState<Patient[]>([]);
  const [doctors, setDoctors]             = useState<Doctor[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [recallVisitId, setRecallVisitId] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientId:       prefill?.patientId  ?? "",
    doctorId:        prefill?.doctorId   ?? "",
    appointmentDate: prefill?.date       ?? "",
    appointmentTime: prefill?.time       ?? "",
    type:            prefill?.type       ?? "CONSULTATION",
    notes:           prefill?.notes      ?? "",
  });

  // Patient search
  useEffect(() => {
    const timer = setTimeout(() => {
      patientsApi.list({ search: patientSearch || undefined })
        .then((d) => setPatients((d.patients || []).slice(0, 20)));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Load doctors (filtered by branch if set)
  useEffect(() => {
    async function loadUser() {
      try {
        const meData = await authApi.me();
        const me = meData.user;
        if (!me) return;
        setCurrentUserRole(me.role);
        setCurrentUserName(me.name ?? "");

        if (me.role === "ADMIN" || me.role === "RECEPTIONIST") {
          const [membersData, assignmentsData] = await Promise.all([
            orgApi.members.list(),
            selectedLocationId ? locationsApi.staff.list(selectedLocationId).catch(() => null) : Promise.resolve(null),
          ]);
          const assignedIds =
            assignmentsData && assignmentsData.assignments.length > 0
              ? new Set(assignmentsData.assignments.map((a: { userId: string }) => a.userId))
              : null;
          const eligible = (membersData.members || []).filter(
            (m: { role: string; isDoctor?: number; userId: string }) =>
              (m.role === "DOCTOR" || (m.role === "ADMIN" && m.isDoctor === 1)) &&
              (assignedIds === null || assignedIds.has(m.userId))
          );
          setDoctors(eligible.map((m: { userId: string; name: string; role: string }) => ({ id: m.userId, name: m.name, role: m.role })));
        } else {
          setForm((f) => ({ ...f, doctorId: me.userId }));
        }
      } catch {
        // silently degrade
      }
    }
    loadUser();
  }, [selectedLocationId]);

  // Apply prefill once on mount
  useEffect(() => {
    if (initApplied.current || !prefill) return;
    initApplied.current = true;
    if (prefill.recallVisitId) setRecallVisitId(prefill.recallVisitId);
    if (prefill.patientId) {
      patientsApi.get(prefill.patientId)
        .then((d) => {
          if (d.patient) {
            setPatients((prev) => {
              const exists = prev.find((p) => p.id === d.patient.id);
              return exists ? prev : [d.patient, ...prev];
            });
          }
        })
        .catch(() => patientsApi.list().then((d) => setPatients((d.patients || []).slice(0, 20))));
    }
  }, [prefill]);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.patientId)  { setError("Please select a patient"); return; }
    if (!form.doctorId)   { setError("Please select a doctor");  return; }
    if (form.appointmentDate < new Date().toISOString().split("T")[0]) {
      setError("Appointment date cannot be in the past");
      return;
    }
    setLoading(true);
    try {
      await appointmentsApi.create({
        ...form,
        type: form.type as import("@/types").AppointmentType,
        ...(recallVisitId      ? { recallVisitId }                      : {}),
        ...(selectedLocationId ? { locationId: selectedLocationId }      : {}),
      });
      toast.success("Appointment booked successfully");
      onSuccess();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong.";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const open  = selectedLocation?.settings?.openingTime;
  const close = selectedLocation?.settings?.closingTime;
  const outsideHours =
    open && close && form.appointmentTime &&
    (form.appointmentTime < open || form.appointmentTime >= close);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-pk-surface rounded-pk-lg shadow-pk-e3 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pk-border">
          <h2 className="text-lg font-semibold text-pk-text">New Appointment</h2>
          <button
            onClick={onClose}
            className="text-pk-text-muted hover:text-pk-text transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Patient */}
          <div>
            <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Patient *</label>
            <input
              type="text"
              placeholder="Search patient by name or code..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full px-4 py-2.5 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 mb-2"
            />
            <select
              value={form.patientId}
              onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
              className="w-full px-4 py-2.5 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            >
              <option value="">— Select Patient —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.patientCode} · {p.name}</option>
              ))}
            </select>
          </div>

          {/* Doctor */}
          {currentUserRole === "ADMIN" || currentUserRole === "RECEPTIONIST" ? (
            <Select id="modal-doctor" label="Doctor *" value={form.doctorId} onChange={update("doctorId")}>
              <option value="">— Select Doctor —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{formatDoctorName(d.name)}</option>
              ))}
            </Select>
          ) : (
            <div>
              <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Doctor</label>
              <p className="w-full px-4 py-2.5 border border-pk-border rounded-pk-sm text-sm bg-pk-surface-raised text-pk-text-secondary">
                {currentUserName ? formatDoctorName(currentUserName) : <span className="text-pk-text-muted">Loading…</span>}
              </p>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <Input id="modal-date" type="date" label="Date *" value={form.appointmentDate} onChange={update("appointmentDate")} required />
            <Input id="modal-time" type="time" label="Time *" value={form.appointmentTime} onChange={update("appointmentTime")} required />
          </div>

          {/* Outside-hours warning */}
          {outsideHours && (
            <div className="flex items-start gap-2 text-xs text-pk-warning-text bg-pk-warning-fill border border-pk-warning-border rounded-pk-sm px-3 py-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                This time is outside {selectedLocation!.name}&apos;s hours ({open}–{close}).
                You can still book — this is just a reminder.
              </span>
            </div>
          )}

          {/* Type */}
          <Select id="modal-type" label="Appointment Type" value={form.type} onChange={update("type")}>
            <option value="CONSULTATION">Consultation</option>
            <option value="CHECKUP">Checkup</option>
            <option value="TREATMENT">Treatment</option>
            <option value="FOLLOWUP">Follow-up</option>
          </Select>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={update("notes")}
              rows={3}
              placeholder="Additional notes..."
              className="w-full px-4 py-2.5 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Book Appointment"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
