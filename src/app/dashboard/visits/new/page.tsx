"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { formatDoctorName } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/context/toast-context";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { appointmentsApi, visitsApi, patientsApi, orgApi, authApi, ApiError } from "@/api";

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
  appointmentTime?: string | null;
  type: string;
  notes?: string | null;
  doctorId: string;
}

type VisitSource = "" | "appointment" | "walkin";

export default function NewVisitPage() {
  return (
    <Suspense>
      <NewVisitForm />
    </Suspense>
  );
}

function NewVisitForm() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const prefillApplied = useRef(false);

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
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    patientsApi.list({ limit: 200 })
      .then((d) => setPatients(d.patients || []));
    Promise.all([
      orgApi.members.list(),
      authApi.me(),
    ]).then(([membersData, meData]) => {
      const eligible = (membersData.members || []).filter(
        (m: { role: string; isDoctor?: number }) => m.role === "DOCTOR" || (m.role === "ADMIN" && m.isDoctor === 1)
      );
      setDoctors(
        eligible.map((m: { userId: string; name: string; role: string }) => ({
          id: m.userId,
          name: m.name,
          role: m.role,
        }))
      );
      const me = meData.user;
      if (me) {
        setCurrentUserRole(me.role);
        setCurrentUserId(me.userId);
        if (me.role === "DOCTOR") {
          setForm((f) => ({ ...f, doctorId: me.userId }));
        }
      }
    }).catch(() => {});
  }, []);

  // Pre-fill from URL params (?patientId=X&appointmentId=Y&doctorId=Z)
  useEffect(() => {
    if (prefillApplied.current || patients.length === 0) return;
    const paramPatientId = searchParams.get("patientId");
    const paramAppointmentId = searchParams.get("appointmentId");
    const paramDoctorId = searchParams.get("doctorId");
    if (!paramPatientId) return;
    prefillApplied.current = true;

    const patient = patients.find((p) => p.id === paramPatientId) || null;
    if (patient) {
      setSelectedPatient(patient);
      setSearch(patient.name);
    }

    if (paramDoctorId) {
      setForm((f) => ({ ...f, doctorId: paramDoctorId }));
    }

    if (paramAppointmentId) {
      appointmentsApi.get(paramAppointmentId)
        .then((d) => {
          if (d.appointment) {
            const appt = d.appointment as Appointment;
            setAppointments([appt]);
            setSelectedAppointment(appt);
            setVisitSource("appointment");
            setForm((f) => ({
              ...f,
              doctorId: appt.doctorId,
              chiefComplaint: appt.notes || f.chiefComplaint,
            }));
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, searchParams]);

  async function handlePatientSelect(patientId: string) {
    const patient = patients.find((p) => p.id === patientId) || null;
    setSelectedPatient(patient);
    setVisitSource("");
    setSelectedAppointment(null);
    setAppointments([]);
    if (!patientId) return;

    setLoadingAppointments(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await appointmentsApi.list({ patientId, status: "SCHEDULED", date: today });
      const appts: Appointment[] = data.appointments ?? [];
      setAppointments(appts);

      if (appts.length === 1) {
        setVisitSource("appointment");
        setSelectedAppointment(appts[0]);
        setForm((f) => ({ ...f, doctorId: appts[0].doctorId, chiefComplaint: appts[0].notes || "" }));
      }
    } finally {
      setLoadingAppointments(false);
    }
  }

  function selectAppointment(appt: Appointment) {
    setSelectedAppointment(appt);
    setVisitSource("appointment");
    setForm((f) => ({ ...f, doctorId: appt.doctorId, chiefComplaint: appt.notes || f.chiefComplaint }));
  }

  function selectWalkIn() {
    setVisitSource("walkin");
    setSelectedAppointment(null);
  }

  const filteredPatients = patients.filter(
    (p) =>
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.patientCode.toLowerCase().includes(search.toLowerCase())
  );

  const canSubmit = selectedPatient && visitSource && form.doctorId && form.visitDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    try {
      const data = await visitsApi.create({
        patientId: selectedPatient!.id,
        doctorId: form.doctorId,
        visitDate: form.visitDate,
        chiefComplaint: form.chiefComplaint,
        doctorNotes: form.doctorNotes,
        appointmentId: selectedAppointment?.id || null,
        visitType: visitSource === "appointment" ? "APPOINTMENT" : "WALKIN",
      });
      toast.success("Visit created successfully");
      router.push(`/dashboard/visits/${data.visit.id}`);
    } catch (e) {
      // If a visit already exists for this appointment, redirect to it
      if (e instanceof ApiError && e.status === 409 && e.data?.visitId) {
        router.push(`/dashboard/visits/${e.data.visitId}`);
        return;
      }
      const msg = e instanceof ApiError ? e.message : "Failed to create visit";
      toast.error(msg);
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="New Visit"
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Visits", href: "/dashboard/visits" },
          { label: "New" },
        ]}
      />
      <main id="main-content" className="flex-1 p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create New Visit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {/* Step 1: Patient */}
              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1">
                  Patient <span className="text-pk-danger-text">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                />
                <select
                  value={selectedPatient?.id || ""}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
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
                  <label className="block text-sm font-medium text-pk-text-secondary mb-2">
                    Visit Source <span className="text-pk-danger-text">*</span>
                  </label>

                  {loadingAppointments ? (
                    <p className="text-sm text-pk-text-muted py-2">Checking today&apos;s appointments...</p>
                  ) : (
                    <div className="space-y-2">
                      {appointments.length > 0 ? (
                        <>
                          <p className="text-xs text-pk-text-muted">
                            {appointments.length} scheduled appointment
                            {appointments.length > 1 ? "s" : ""} for today:
                          </p>
                          {appointments.map((appt) => (
                            <button
                              key={appt.id}
                              type="button"
                              onClick={() => selectAppointment(appt)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                selectedAppointment?.id === appt.id
                                  ? "border-pk-teal-500 bg-pk-teal-50"
                                  : "border-pk-border hover:border-pk-teal-300 bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-pk-text">
                                    📅 {appt.appointmentTime} —{" "}
                                    {appt.type.charAt(0) + appt.type.slice(1).toLowerCase()}
                                  </p>
                                  {appt.notes && (
                                    <p className="text-xs text-pk-text-muted mt-0.5">{appt.notes}</p>
                                  )}
                                </div>
                                {selectedAppointment?.id === appt.id && (
                                  <span className="text-xs bg-pk-teal-500 text-white px-2 py-0.5 rounded-full">
                                    Selected
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="p-3 rounded-xl bg-pk-surface-raised border border-pk-border text-sm text-pk-text-muted">
                          No scheduled appointments for today.
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={selectWalkIn}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          visitSource === "walkin"
                            ? "border-pk-warning-border bg-pk-warning-fill"
                            : "border-pk-border hover:border-pk-warning-border bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-pk-text-secondary">
                            🚶 Walk-in (no appointment)
                          </span>
                          {visitSource === "walkin" && (
                            <span className="text-xs bg-pk-warning text-white px-2 py-0.5 rounded-full">
                              Selected
                            </span>
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
                  {currentUserRole === "DOCTOR" ? (
                    <div>
                      <label className="block text-sm font-medium text-pk-text-secondary mb-1">Doctor</label>
                      <p className="text-sm px-3 py-2 bg-pk-surface-raised border border-pk-border rounded-lg text-pk-text-secondary">
                        {formatDoctorName(doctors.find((d) => d.id === currentUserId)?.name ?? "")}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-pk-text-secondary mb-1">
                        Doctor <span className="text-pk-danger-text">*</span>
                      </label>
                      <select
                        value={form.doctorId}
                        onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                        className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                      >
                        <option value="">-- Select Doctor --</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {formatDoctorName(d.name)} ({d.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1">
                      Visit Date <span className="text-pk-danger-text">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.visitDate}
                      onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
                      className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1">
                      Chief Complaint
                    </label>
                    <textarea
                      value={form.chiefComplaint}
                      onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                      rows={3}
                      placeholder="Patient symptoms / reason for visit..."
                      className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1">
                      Doctor Notes
                    </label>
                    <textarea
                      value={form.doctorNotes}
                      onChange={(e) => setForm({ ...form, doctorNotes: e.target.value })}
                      rows={3}
                      placeholder="Clinical observations..."
                      className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                {canSubmit && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-pk-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition"
                  >
                    {submitting
                      ? "Creating..."
                      : visitSource === "appointment"
                      ? "Start Appointment Visit"
                      : "Start Walk-in Visit"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2.5 border border-pk-border rounded-lg text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
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
