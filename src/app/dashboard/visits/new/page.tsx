"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Patient {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
}

interface Doctor {
  id: string;
  name: string;
  role: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  type: string;
  notes: string | null;
  doctorId: string;
}

type VisitSource = "" | "appointment" | "walkin";

export default function NewVisitPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [visitSource, setVisitSource] = useState<VisitSource>("");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [form, setForm] = useState({
    doctorId: "",
    visitDate: new Date().toISOString().split("T")[0],
    chiefComplaint: "",
    doctorNotes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patients?limit=200")
      .then((r) => r.json())
      .then((d) => setPatients(d.patients || []));
    fetch("/api/users").then((r) => {
      if (r.ok) r.json().then((d) => setDoctors(d.users || []));
    }).catch(() => {});
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) setDoctors(prev => prev.length ? prev : [{ id: d.user.id, name: d.user.name, role: d.user.role }]);
    });
  }, []);

  async function handlePatientSelect(patientId: string) {
    const patient = patients.find(p => p.id === patientId) || null;
    setSelectedPatient(patient);
    setVisitSource("");
    setSelectedAppointment(null);
    setAppointments([]);
    if (!patientId) return;

    setLoadingAppointments(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/appointments?patientId=${patientId}&status=SCHEDULED&date=${today}`);
      const data = await res.json();
      const appts: Appointment[] = data.appointments || [];
      setAppointments(appts);

      if (appts.length === 1) {
        setVisitSource("appointment");
        setSelectedAppointment(appts[0]);
        setForm(f => ({ ...f, doctorId: appts[0].doctorId, chiefComplaint: appts[0].notes || "" }));
      }
    } finally {
      setLoadingAppointments(false);
    }
  }

  function selectAppointment(appt: Appointment) {
    setSelectedAppointment(appt);
    setVisitSource("appointment");
    setForm(f => ({ ...f, doctorId: appt.doctorId, chiefComplaint: appt.notes || f.chiefComplaint }));
  }

  function selectWalkIn() {
    setVisitSource("walkin");
    setSelectedAppointment(null);
  }

  const filteredPatients = patients.filter(
    (p) => search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.patientCode.toLowerCase().includes(search.toLowerCase())
  );

  const canSubmit = selectedPatient && visitSource && form.doctorId && form.visitDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: selectedPatient!.id,
        doctorId: form.doctorId,
        visitDate: form.visitDate,
        chiefComplaint: form.chiefComplaint,
        doctorNotes: form.doctorNotes,
        appointmentId: selectedAppointment?.id || null,
        visitType: visitSource === "appointment" ? "APPOINTMENT" : "WALKIN",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create visit");
      setSubmitting(false);
      return;
    }

    // Mark appointment as IN_PROGRESS
    if (selectedAppointment) {
      await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
    }

    router.push(`/dashboard/visits/${data.visit.id}`);
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="New Visit"
        breadcrumb={[{ label: "Dashboard" }, { label: "Visits", href: "/dashboard/visits" }, { label: "New" }]}
      />
      <main className="flex-1 p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create New Visit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
              )}

              {/* Step 1: Patient */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Patient <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={selectedPatient?.id || ""}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size={5}
                >
                  <option value="">-- Select Patient --</option>
                  {filteredPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patientCode} · {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Appointment or Walk-in */}
              {selectedPatient && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Visit Type <span className="text-red-500">*</span>
                  </label>

                  {loadingAppointments ? (
                    <p className="text-sm text-slate-400 py-2">Checking today&apos;s appointments...</p>
                  ) : (
                    <div className="space-y-2">
                      {appointments.length > 0 ? (
                        <>
                          <p className="text-xs text-slate-500">
                            {appointments.length} scheduled appointment{appointments.length > 1 ? "s" : ""} for today:
                          </p>
                          {appointments.map(appt => (
                            <button
                              key={appt.id}
                              type="button"
                              onClick={() => selectAppointment(appt)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                selectedAppointment?.id === appt.id
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-slate-200 hover:border-blue-300 bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    📅 {appt.appointmentTime} — {appt.type.charAt(0) + appt.type.slice(1).toLowerCase()}
                                  </p>
                                  {appt.notes && <p className="text-xs text-slate-500 mt-0.5">{appt.notes}</p>}
                                </div>
                                {selectedAppointment?.id === appt.id && (
                                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Selected</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
                          No scheduled appointments for today.
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={selectWalkIn}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          visitSource === "walkin"
                            ? "border-amber-500 bg-amber-50"
                            : "border-slate-200 hover:border-amber-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">🚶 Walk-in (no appointment)</span>
                          {visitSource === "walkin" && (
                            <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">Selected</span>
                          )}
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Doctor, Date, Notes */}
              {visitSource && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Doctor <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.doctorId}
                      onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Doctor --</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>Dr. {d.name} ({d.role})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Visit Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.visitDate}
                      onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
                    <textarea
                      value={form.chiefComplaint}
                      onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                      rows={3}
                      placeholder="Patient symptoms / reason for visit..."
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Doctor Notes</label>
                    <textarea
                      value={form.doctorNotes}
                      onChange={(e) => setForm({ ...form, doctorNotes: e.target.value })}
                      rows={3}
                      placeholder="Clinical observations..."
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                {canSubmit && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {submitting ? "Creating..." : visitSource === "appointment" ? "Start Appointment Visit" : "Start Walk-in Visit"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
