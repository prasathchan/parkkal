"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { patientsApi, visitsApi, appointmentsApi, treatmentsApi, invoicesApi, ApiError } from "@/api";
import type { PatientPrescription } from "@/api/patients";
import Link from "next/link";
import { parseAddress, formatAddressDisplay } from "@/lib/address";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatDate, calculateAge, formatCurrency, formatDoctorName } from "@/lib/utils";
import { ToothChart, type ChartData } from "@/components/ui/ToothChart";
import type { ToothChartHistoryEntry } from "@/api/patients";

interface Patient {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  medicalHistory?: string | null;
  createdAt: number;
}

interface PatientBalance {
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  visitCount: number;
  pendingVisits: number;
  lastVisit: string | null;
}

type TabType = "visits" | "appointments" | "treatments" | "invoices" | "prescriptions" | "chart" | "emergency";

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [balance, setBalance] = useState<PatientBalance | null>(null);
  const [tab, setTab] = useState<TabType>("visits");
  const [tabData, setTabData] = useState<unknown[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [rxData, setRxData] = useState<PatientPrescription[]>([]);
  const [chartData, setChartData] = useState<ChartData>({});
  const [chartSaving, setChartSaving] = useState(false);
  const [chartHistory, setChartHistory] = useState<ToothChartHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eraseModal, setEraseModal] = useState(false);
  const [eraseConfirmText, setEraseConfirmText] = useState("");
  const [eraseLoading, setEraseLoading] = useState(false);
  const [eraseError, setEraseError] = useState("");
  const router = useRouter();

  useEffect(() => {
    patientsApi.get(id)
      .then((d) => setPatient(d.patient))
      .finally(() => setLoading(false));
    patientsApi.balance(id)
      .then((d) => setBalance(d))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (tab === "emergency") {
      patientsApi.emergencyContacts(id)
        .then((d) => setEmergencyContacts(d.contacts || []))
        .catch(() => setEmergencyContacts([]));
      return;
    }
    if (tab === "prescriptions") {
      patientsApi.listPrescriptions(id)
        .then((d) => setRxData(d.prescriptions || []))
        .catch(() => setRxData([]));
      return;
    }
    if (tab === "chart") {
      patientsApi.getToothChart(id)
        .then((d) => setChartData((d.toothData as ChartData) ?? {}))
        .catch(() => {});
      patientsApi.getToothChartHistory(id)
        .then((d) => setChartHistory(d.history))
        .catch(() => {});
      return;
    }
    const fetchers: Record<Exclude<TabType, "emergency" | "chart" | "prescriptions">, () => Promise<unknown>> = {
      visits:       () => visitsApi.list({ patientId: id }),
      appointments: () => appointmentsApi.list({ patientId: id }),
      treatments:   () => treatmentsApi.list({ patientId: id }),
      invoices:     () => invoicesApi.list({ patientId: id }),
    };
    fetchers[tab as Exclude<TabType, "emergency" | "chart" | "prescriptions">]()
      .then((d) => {
        const r = d as Record<string, unknown[]>;
        setTabData(r.visits || r.appointments || r.treatments || r.invoices || []);
      });
  }, [id, tab]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Patient not found.</p>
        <Link href="/dashboard/patients" className="text-blue-600 hover:underline text-sm">
          Back to Patients
        </Link>
      </div>
    );
  }

  async function saveChart(data: ChartData) {
    setChartData(data);
    setChartSaving(true);
    try {
      await patientsApi.saveToothChart(id, data as Record<string, unknown>);
      // Refresh history so the new entry appears immediately
      patientsApi.getToothChartHistory(id)
        .then((d) => setChartHistory(d.history))
        .catch(() => {});
    } finally {
      setChartSaving(false);
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: "visits", label: "Visits" },
    { key: "appointments", label: "Appointments" },
    { key: "treatments", label: "Treatments" },
    { key: "invoices", label: "Invoices" },
    { key: "prescriptions", label: "Prescriptions" },
    { key: "chart", label: "Tooth Chart" },
    { key: "emergency", label: "Emergency" },
  ];

  async function handleErase() {
    if (eraseConfirmText !== "ERASE") return;
    setEraseLoading(true);
    setEraseError("");
    try {
      await patientsApi.erase(id);
      router.push("/dashboard/patients");
    } catch (e) {
      setEraseError(e instanceof ApiError ? e.message : "Failed to erase patient data.");
    } finally {
      setEraseLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={patient.name}
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Patients", href: "/dashboard/patients" },
          { label: patient.patientCode },
        ]}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Balance Card */}
        {balance && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Financial Summary</h3>
              <Link
                href={`/dashboard/visits/new?patientId=${patient?.id}`}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition"
              >
                + New Visit
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Total Billed</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(balance.totalBilled)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Total Paid</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(balance.totalPaid)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Outstanding</p>
                <p className={`text-lg font-bold ${balance.totalDue > 0 ? "text-red-600" : "text-slate-400"}`}>
                  {formatCurrency(balance.totalDue)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Total Visits</p>
                <p className="text-lg font-bold text-slate-900">{balance.visitCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Last Visit</p>
                <p className="text-sm font-semibold text-slate-700">{balance.lastVisit || "—"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Patient Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Patient Details</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                  {patient.patientCode}
                </span>
                <Link
                  href={`/dashboard/patients/${patient.id}/edit`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Phone</p>
                <p className="font-medium">{patient.phone}</p>
              </div>
              {patient.email && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Email</p>
                  <p className="font-medium">{patient.email}</p>
                </div>
              )}
              {patient.dateOfBirth && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Age</p>
                  <p className="font-medium">
                    {calculateAge(patient.dateOfBirth)} yrs ({patient.dateOfBirth})
                  </p>
                </div>
              )}
              {patient.gender && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Gender</p>
                  <p className="font-medium">{patient.gender}</p>
                </div>
              )}
              {patient.bloodGroup && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Blood Group</p>
                  <p className="font-medium text-red-600">{patient.bloodGroup}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Registered</p>
                <p className="font-medium">{formatDate(patient.createdAt)}</p>
              </div>
            </div>
            {patient.address && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-slate-500 text-xs mb-0.5">Address</p>
                <p className="text-sm">{formatAddressDisplay(parseAddress(patient.address))}</p>
              </div>
            )}
            {patient.medicalHistory && (
              <div className="mt-3">
                <p className="text-slate-500 text-xs mb-0.5">Medical History</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
                  {patient.medicalHistory}
                </p>
              </div>
            )}
            {/* Erase Patient Data — DPDP Act 2023 right to erasure */}
            <div className="mt-4 pt-4 border-t border-red-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-red-700">Erase Patient Data</p>
                  <p className="text-xs text-slate-400 mt-0.5">Permanently delete all records for this patient (DPDP Act right to erasure). This cannot be undone.</p>
                </div>
                <button
                  onClick={() => { setEraseModal(true); setEraseConfirmText(""); setEraseError(""); }}
                  className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition font-medium shrink-0 ml-4"
                >
                  Erase Data
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Erase confirmation modal */}
        {eraseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl border border-red-200 shadow-xl max-w-md w-full p-6">
              <h2 className="text-base font-bold text-red-700 mb-1">Permanently Erase Patient Data</h2>
              <p className="text-sm text-slate-600 mb-4">
                This will permanently delete <strong>{patient?.name}</strong> and all associated visits, prescriptions,
                invoices, appointments, and records. This action is irreversible and will be recorded in the audit log.
              </p>
              <p className="text-xs text-slate-500 mb-2">Type <strong>ERASE</strong> to confirm:</p>
              <input
                type="text"
                value={eraseConfirmText}
                onChange={(e) => setEraseConfirmText(e.target.value)}
                placeholder="ERASE"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              {eraseError && <p className="text-xs text-red-600 mb-3">{eraseError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={handleErase}
                  disabled={eraseConfirmText !== "ERASE" || eraseLoading}
                  className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {eraseLoading ? "Erasing…" : "Permanently Erase"}
                </button>
                <button
                  onClick={() => setEraseModal(false)}
                  className="flex-1 border border-slate-200 text-slate-700 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Card>
          <div className="border-b border-slate-100 px-6">
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <CardContent>
            {tab === "chart" ? (
              <div>
                {/* Chart header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">FDI Dental Chart</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Click any tooth to record its condition. Changes save automatically.</p>
                  </div>
                  {chartSaving && (
                    <span className="text-xs text-slate-400 animate-pulse">Saving…</span>
                  )}
                </div>

                <ToothChart data={chartData} onChange={saveChart} />

                {/* History timeline */}
                {chartHistory.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowHistory((h) => !h)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Chart History ({chartHistory.length} {chartHistory.length === 1 ? "save" : "saves"})
                    </button>

                    {showHistory && (
                      <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
                        {chartHistory.map((entry) => (
                          <li key={entry.id} className="relative">
                            <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white" />
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-xs font-medium text-slate-700">
                                {new Date(entry.recordedAt).toLocaleDateString("en-IN", {
                                  day: "numeric", month: "short", year: "numeric",
                                })}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(entry.recordedAt).toLocaleTimeString("en-IN", {
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                              {entry.visitCode && (
                                <Link
                                  href={`/dashboard/visits/${entry.visitId}`}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  {entry.visitCode}
                                </Link>
                              )}
                              <span className="text-xs text-slate-500">by {entry.recordedByName}</span>
                            </div>
                            {entry.changedTeeth.length > 0 ? (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Changed:{" "}
                                {entry.changedTeeth.map((t) => (
                                  <span key={t} className="inline-flex items-center px-1 rounded bg-slate-100 font-mono text-slate-700 mr-0.5">
                                    {t}
                                  </span>
                                ))}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 mt-0.5">No condition changes</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            ) : tab === "prescriptions" ? (
              rxData.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-6">No prescriptions recorded for this patient.</p>
              ) : (
                <div className="space-y-4">
                  {rxData.map((rx) => (
                    <div key={rx.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
                        <Link href={`/dashboard/visits/${rx.visitId}?tab=prescriptions`} className="text-xs text-blue-600 hover:underline font-medium">
                          View visit →
                        </Link>
                        <span className="text-sm font-medium text-slate-700">Dr. {rx.doctorName}</span>
                        {rx.visitDate && (
                          <span className="text-xs text-slate-400">
                            {new Date(rx.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {rx.medicines.map((med, i) => (
                          <div key={i} className="px-5 py-3 grid grid-cols-4 gap-2 text-sm">
                            <p className="font-medium text-slate-800">{med.name}</p>
                            <p className="text-slate-600">{med.dosage}</p>
                            <p className="text-slate-600">{med.frequency}</p>
                            <p className="text-slate-600">{med.duration}</p>
                          </div>
                        ))}
                      </div>
                      {rx.medicines.length > 0 && (
                        <div className="px-5 py-1.5 grid grid-cols-4 gap-2 bg-slate-50 border-t border-slate-100">
                          {["Drug", "Dosage", "Frequency", "Duration"].map((h) => (
                            <p key={h} className="text-xs text-slate-400 font-medium">{h}</p>
                          ))}
                        </div>
                      )}
                      {rx.instructions && (
                        <div className="px-5 py-3 border-t border-slate-100 bg-amber-50">
                          <p className="text-xs text-amber-700"><span className="font-semibold">Instructions: </span>{rx.instructions}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : tab === "emergency" ? (
              emergencyContacts.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-6">No emergency contacts on file.</p>
              ) : (
                <div className="space-y-3">
                  {emergencyContacts.map((c) => (
                    <div key={c.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.relationship}</p>
                        {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                      </div>
                      <p className="text-sm font-medium text-slate-700">{c.phone}</p>
                    </div>
                  ))}
                </div>
              )
            ) : tabData.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">
                No {tab} found for this patient.
              </p>
            ) : (
              <div className="space-y-3">
                {tabData.map((item: unknown) => {
                  const row = item as Record<string, unknown>;
                  if (tab === "visits") {
                    const due = (row.totalAmount as number) - (row.paidAmount as number);
                    return (
                      <a
                        key={row.id as string}
                        href={`/dashboard/visits/${row.id}`}
                        className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-1 transition"
                      >
                        <div>
                          <p className="text-sm font-mono font-medium text-blue-700">{row.visitCode as string}</p>
                          <p className="text-xs text-slate-500">{row.visitDate as string} · {formatDoctorName(row.doctorName as string)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(row.totalAmount as number)}</p>
                          {due > 0 && <p className="text-xs text-red-500">Due {formatCurrency(due)}</p>}
                          <Badge variant={getStatusBadgeVariant(row.status as string)}>{row.status as string}</Badge>
                        </div>
                      </a>
                    );
                  }
                  if (tab === "appointments") {
                    return (
                      <div key={row.id as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium">
                            {row.appointmentDate as string} at {row.appointmentTime as string}
                          </p>
                          <p className="text-xs text-slate-500">{row.type as string}</p>
                        </div>
                        <Badge variant={getStatusBadgeVariant(row.status as string)}>
                          {row.status as string}
                        </Badge>
                      </div>
                    );
                  }
                  if (tab === "treatments") {
                    return (
                      <div key={row.id as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{(row.itemName || row.description) as string}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {(row.category as string) && (
                              <span className="text-xs text-slate-400">{row.category as string}</span>
                            )}
                            {((row.toothNumber || row.toothNumbers) as string) && (
                              <span className="text-xs text-slate-400">
                                Tooth: {(row.toothNumber || row.toothNumbers) as string}
                              </span>
                            )}
                            {(row.visitDate as string) && (
                              <span className="text-xs text-slate-400">{row.visitDate as string}</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency((row.amount ?? row.cost ?? 0) as number)}
                        </p>
                      </div>
                    );
                  }
                  if (tab === "invoices") {
                    return (
                      <div key={row.id as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium">
                            Invoice · {formatDate(row.createdAt as number)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Paid: {formatCurrency(row.paidAmount as number)} / {formatCurrency(row.totalAmount as number)}
                          </p>
                        </div>
                        <Badge variant={getStatusBadgeVariant(row.status as string)}>
                          {row.status as string}
                        </Badge>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
