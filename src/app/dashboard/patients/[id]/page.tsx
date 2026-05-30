"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatDate, calculateAge, formatCurrency } from "@/lib/utils";

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

type TabType = "appointments" | "treatments" | "invoices";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<TabType>("appointments");
  const [tabData, setTabData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((r) => r.json())
      .then((d) => setPatient(d.patient))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const urls: Record<TabType, string> = {
      appointments: `/api/appointments?patientId=${id}`,
      treatments: `/api/treatments?patientId=${id}`,
      invoices: `/api/invoices?patientId=${id}`,
    };
    fetch(urls[tab])
      .then((r) => r.json())
      .then((d) => setTabData(d.appointments || d.treatments || d.invoices || []));
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
    { key: "appointments", label: "Appointments" },
    { key: "treatments", label: "Treatments" },
    { key: "invoices", label: "Invoices" },
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
        {/* Patient Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Patient Details</CardTitle>
              <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                {patient.patientCode}
              </span>
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
            {tabData.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">
                No {tab} found for this patient.
              </p>
            ) : (
              <div className="space-y-3">
                {tabData.map((item: unknown) => {
                  const row = item as Record<string, unknown>;
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
                          <p className="text-sm font-medium">{row.description as string}</p>
                          <p className="text-xs text-slate-500">{row.procedure as string}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(row.cost as number)}
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
