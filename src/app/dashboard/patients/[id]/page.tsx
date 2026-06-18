"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { patientsApi, visitsApi, appointmentsApi, treatmentsApi, invoicesApi, authApi } from "@/api";
import type { PatientPrescription, ToothChartHistoryEntry } from "@/api/patients";
import Link from "next/link";
import { Header } from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PatientDetailsCard } from "@/components/patients/PatientDetailsCard";
import { PatientChartTab } from "@/components/patients/PatientChartTab";
import { PatientPrescriptionsTab } from "@/components/patients/PatientPrescriptionsTab";
import { PatientEmergencyTab } from "@/components/patients/PatientEmergencyTab";
import { PatientTabList } from "@/components/patients/PatientTabList";
import { type ChartData } from "@/components/ui/ToothChart";

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
  dataConsentAt?: number | null;
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

interface EmergencyContact { id: string; name: string; relationship: string; phone: string; email?: string | null; }

type TabType = "visits" | "appointments" | "treatments" | "invoices" | "prescriptions" | "chart" | "emergency";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
  const [isAdmin, setIsAdmin] = useState(false);
  // Collapsible card state — all open by default
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [tabsOpen, setTabsOpen] = useState(true);

  useEffect(() => {
    patientsApi.get(id).then((d) => setPatient(d.patient)).finally(() => setLoading(false));
    patientsApi.balance(id).then((d) => setBalance(d)).catch(() => {});
    authApi.me().then((d) => setIsAdmin(d.user.role === "ADMIN")).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (tab === "emergency") {
      patientsApi.emergencyContacts(id).then((d) => setEmergencyContacts(d.contacts || [])).catch(() => setEmergencyContacts([]));
      return;
    }
    if (tab === "prescriptions") {
      patientsApi.listPrescriptions(id).then((d) => setRxData(d.prescriptions || [])).catch(() => setRxData([]));
      return;
    }
    if (tab === "chart") {
      patientsApi.getToothChart(id).then((d) => setChartData((d.toothData as ChartData) ?? {})).catch(() => {});
      patientsApi.getToothChartHistory(id).then((d) => setChartHistory(d.history)).catch(() => {});
      return;
    }
    const fetchers: Record<Exclude<TabType, "emergency" | "chart" | "prescriptions">, () => Promise<unknown>> = {
      visits:       () => visitsApi.list({ patientId: id }),
      appointments: () => appointmentsApi.list({ patientId: id }),
      treatments:   () => treatmentsApi.list({ patientId: id }),
      invoices:     () => invoicesApi.list({ patientId: id }),
    };
    fetchers[tab as Exclude<TabType, "emergency" | "chart" | "prescriptions">]()
      .then((d) => { const r = d as Record<string, unknown[]>; setTabData(r.visits || r.appointments || r.treatments || r.invoices || []); });
  }, [id, tab]);

  async function saveChart(data: ChartData) {
    setChartData(data);
    setChartSaving(true);
    try {
      await patientsApi.saveToothChart(id, data as Record<string, unknown>);
      patientsApi.getToothChartHistory(id).then((d) => setChartHistory(d.history)).catch(() => {});
    } finally { setChartSaving(false); }
  }

  async function handleErase() {
    await patientsApi.erase(id);
    router.push("/dashboard/patients");
  }

  async function handleWithdrawConsent() {
    await patientsApi.withdrawConsent(id);
    setPatient((p) => p ? { ...p, dataConsentAt: null } : p);
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

  if (loading) return <div className="flex-1 flex items-center justify-center text-pk-text-muted">Loading...</div>;
  if (!patient) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-pk-text-muted">Patient not found.</p>
        <Link href="/dashboard/patients" className="text-pk-teal-600 hover:underline text-sm">Back to Patients</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title={patient.name} breadcrumb={[{ label: "Dashboard" }, { label: "Patients", href: "/dashboard/patients" }, { label: patient.patientCode }]} />

      <main id="main-content" className="flex-1 p-6 space-y-6">
        {balance && (
          <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1">
            <div className="flex items-center justify-between px-5 py-4">
              <button type="button" onClick={() => setSummaryOpen((o) => !o)} className="flex items-center gap-2 text-left">
                <svg className={`w-4 h-4 text-pk-text-muted transition-transform ${summaryOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <h3 className="font-semibold text-pk-text">Financial Summary</h3>
              </button>
              <Link href={`/dashboard/visits/new?patientId=${patient.id}`} className="inline-flex items-center gap-2 bg-pk-teal-600 text-white px-3 py-1.5 rounded-pk-sm text-xs font-medium hover:bg-pk-teal-700 transition">
                + New Visit
              </Link>
            </div>
            {summaryOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 px-5 pb-5">
                {[
                  { label: "Total Billed", value: formatCurrency(balance.totalBilled), color: "text-pk-text" },
                  { label: "Total Paid", value: formatCurrency(balance.totalPaid), color: "text-pk-success-text" },
                  { label: "Outstanding", value: formatCurrency(balance.totalDue), color: balance.totalDue > 0 ? "text-pk-danger-text" : "text-pk-text-muted" },
                  { label: "Total Visits", value: String(balance.visitCount), color: "text-pk-text" },
                  { label: "Last Visit", value: balance.lastVisit || "—", color: "text-pk-text-secondary", small: true },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-xs text-pk-text-muted mb-1">{stat.label}</p>
                    <p className={`${stat.small ? "text-sm" : "text-lg"} font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <PatientDetailsCard patient={patient} collapsed={!detailsOpen} onToggleCollapse={() => setDetailsOpen((o) => !o)} onErase={handleErase} isAdmin={isAdmin} onWithdrawConsent={handleWithdrawConsent} />

        <Card>
          <div className="flex items-center gap-3 px-6 py-3 border-b border-pk-border">
            <button type="button" onClick={() => setTabsOpen((o) => !o)} className="flex items-center gap-1.5 shrink-0">
              <svg className={`w-4 h-4 text-pk-text-muted transition-transform ${tabsOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => { setTab(t.key); if (!tabsOpen) setTabsOpen(true); }} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? "border-pk-teal-600 text-pk-teal-600" : "border-transparent text-pk-text-muted hover:text-pk-text-secondary"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {tabsOpen && (
            <CardContent>
              {tab === "chart" && <PatientChartTab patientId={id} chartData={chartData} chartSaving={chartSaving} chartHistory={chartHistory} showHistory={showHistory} onChartChange={saveChart} onToggleHistory={() => setShowHistory((h) => !h)} />}
              {tab === "prescriptions" && <PatientPrescriptionsTab prescriptions={rxData} />}
              {tab === "emergency" && <PatientEmergencyTab contacts={emergencyContacts} />}
              {(tab === "visits" || tab === "appointments" || tab === "treatments" || tab === "invoices") && (
                <PatientTabList tab={tab} tabData={tabData} />
              )}
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}
