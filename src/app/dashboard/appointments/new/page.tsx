"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { formatDoctorName } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/context/toast-context";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { appointmentsApi, patientsApi, orgApi, authApi, ApiError } from "@/api";


interface Patient { id: string; patientCode: string; name: string; }
interface Doctor { id: string; name: string; role: string; }

export default function NewAppointmentPage() {
  return (
    <Suspense>
      <NewAppointmentForm />
    </Suspense>
  );
}

function NewAppointmentForm() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const prefillApplied = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [_currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [recallVisitId, setRecallVisitId] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    appointmentDate: "",
    appointmentTime: "",
    type: "CONSULTATION",
    notes: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      patientsApi.list({ search: patientSearch || undefined })
        .then((d) => setPatients((d.patients || []).slice(0, 20)));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  useEffect(() => {
    authApi.me()
      .then((meData) => {
        const me = meData.user;
        if (!me) return;
        setCurrentUserRole(me.role);
        setCurrentUserId(me.userId);
        setCurrentUserName(me.name ?? "");

        if (me.role === "ADMIN" || me.role === "RECEPTIONIST") {
          // Fetch full staff list so they can pick any doctor
          orgApi.members.list()
            .then((membersData) => {
              const eligible = (membersData.members || []).filter(
                (m: { role: string; isDoctor?: number }) =>
                  m.role === "DOCTOR" || (m.role === "ADMIN" && m.isDoctor === 1)
              );
              setDoctors(eligible.map((m: { userId: string; name: string; role: string }) => ({ id: m.userId, name: m.name, role: m.role })));
            })
            .catch(() => {});
        } else {
          // Non-admin/receptionist: auto-assign to themselves (doctor, nurse, etc.)
          setForm((f) => ({ ...f, doctorId: me.userId }));
        }
      })
      .catch(() => {});
  }, []);

  // Pre-fill from URL params — supports recall flow and general follow-up flow
  useEffect(() => {
    if (prefillApplied.current) return;
    const paramPatientId   = searchParams.get("patientId");
    const paramDoctorId    = searchParams.get("doctorId");
    const paramRecallVisit = searchParams.get("recallVisitId");
    const paramType        = searchParams.get("type");
    if (!paramPatientId && !paramDoctorId && !paramRecallVisit) return;
    prefillApplied.current = true;

    if (paramRecallVisit) setRecallVisitId(paramRecallVisit);

    const updates: Partial<typeof form> = {};
    if (paramDoctorId)  updates.doctorId  = paramDoctorId;
    if (paramPatientId) updates.patientId = paramPatientId;
    // Honour explicit type param (e.g. FOLLOWUP from recalls), default to FOLLOWUP
    updates.type = paramType ?? "FOLLOWUP";
    if (paramPatientId || paramDoctorId || paramRecallVisit) {
      setForm((f) => ({ ...f, ...updates }));
    }

    // Fetch patient details so the select shows the correct option
    if (paramPatientId) {
      patientsApi.get(paramPatientId)
        .then((d) => {
          if (d.patient) {
            setPatients((prev) => {
              const exists = prev.find((p) => p.id === d.patient.id);
              return exists ? prev : [d.patient, ...prev];
            });
          }
        })
        .catch(() => {
          // Fallback: search empty to get list
          patientsApi.list()
            .then((d) => setPatients((d.patients || []).slice(0, 20)));
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.patientId) { setError("Please select a patient"); return; }
    if (!form.doctorId) { setError("Please select a doctor"); return; }
    if (form.appointmentDate < new Date().toISOString().split("T")[0]) {
      setError("Appointment date cannot be in the past");
      return;
    }
    setLoading(true);

    try {
      await appointmentsApi.create({
        ...form,
        type: form.type as import("@/types").AppointmentType,
        ...(recallVisitId ? { recallVisitId } : {}),
      });
      toast.success("Appointment booked successfully");
      router.push("/dashboard/appointments");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong.";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="New Appointment"
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Appointments", href: "/dashboard/appointments" },
          { label: "New" },
        ]}
      />

      <main id="main-content" className="flex-1 p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Appointment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Patient search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Patient *
                </label>
                <input
                  type="text"
                  placeholder="Search patient by name or code..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                />
                <select
                  value={form.patientId}
                  onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select Patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patientCode} · {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {currentUserRole === "ADMIN" || currentUserRole === "RECEPTIONIST" ? (
                <Select
                  id="doctor"
                  label="Doctor *"
                  value={form.doctorId}
                  onChange={update("doctorId")}
                >
                  <option value="">— Select Doctor —</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatDoctorName(d.name)}
                    </option>
                  ))}
                </Select>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Doctor</label>
                  <p className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700">
                    {currentUserName ? formatDoctorName(currentUserName) : <span className="text-slate-400">Loading…</span>}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="date"
                  type="date"
                  label="Date *"
                  value={form.appointmentDate}
                  onChange={update("appointmentDate")}
                  required
                />
                <Input
                  id="time"
                  type="time"
                  label="Time *"
                  value={form.appointmentTime}
                  onChange={update("appointmentTime")}
                  required
                />
              </div>

              <Select id="type" label="Appointment Type" value={form.type} onChange={update("type")}>
                <option value="CONSULTATION">Consultation</option>
                <option value="CHECKUP">Checkup</option>
                <option value="TREATMENT">Treatment</option>
                <option value="FOLLOWUP">Follow-up</option>
              </Select>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={update("notes")}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Book Appointment"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
