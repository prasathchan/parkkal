"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatDate, calculateAge, formatCurrency, formatDoctorName } from "@/lib/utils";

interface Patient {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  medicalHistory?: string;
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

type TabType = "visits" | "appointments" | "treatments" | "invoices" | "emergency";

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [balance, setBalance] = useState<PatientBalance | null>(null);
  const [tab, setTab] = useState<TabType>("visits");
  const [tabData, setTabData] = useState<unknown[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((r) => r.json())
      .then((d) => setPatient(d.patient))
      .finally(() => setLoading(false));
    fetch(`/api/patients/${id}/balance`)
      .then((r) => r.json())
      .then((d) => setBalance(d))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (tab === "emergency") {
      fetch(`/api/patients/${id}/emergency-contacts`)
        .then((r) => r.json())
        .then((d) => setEmergencyContacts(d.contacts || []))
        .catch(() => setEmergencyContacts([]));
      return;
    }
    const urls: Record<Exclude<TabType, "emergency">, string> = {
      visits: `/api/visits?patientId=${id}`,
      appointments: `/api/appointments?patientId=${id}`,
      treatments: `/api/treatments?patientId=${id}`,
      invoices: `/api/invoices?patientId=${id}`,
    };
    fetch(urls[tab as Exclude<TabType, "emergency">])
      .then((r) => r.json())
      .then((d) => setTabData(d.visits || d.appointments || d.treatments || d.invoices || []));
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

  const tabs: { key: TabType; label: string }[] = [
    { key: "visits", label: "Visits" },
    { key: "appointments", label: "Appointments" },
    { key: "treatments", label: "Treatments" },
    { key: "invoices", label: "Invoices" },
    { key: "emergency", label: "Emergency" },
  ];

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
                href={`/dashboard/visits/new`}
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
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Registered</p>
                <p className="font-medium">{formatDate(patient.createdAt)}</p>
              </div>
            </div>
            {patient.address && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-slate-500 text-xs mb-0.5">Address</p>
                <p className="text-sm">{patient.address}</p>
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
          </CardContent>
        </Card>

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
            {tab === "emergency" ? (
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
