"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DayRevenue { date: string; billed: number; collected: number; }
interface DayCount   { date: string; count: number; }

interface ReportData {
  period: { days: number; startMs: number; label: string };
  summary: {
    totalPatients:  number;
    periodVisits:   number;
    totalBilled:    number;
    totalCollected: number;
    collectionRate: number;
    outstanding:    number;
  };
  revenueByDay:       DayRevenue[];
  newPatients:        DayCount[];
  visitsByStatus:     Record<string, number>;
  apptByStatus:       Record<string, number>;
  topProcedures:      { procedure: string; count: number; revenue: number }[];
  treatmentByStatus:  Record<string, number>;
}

type Period = "30d" | "90d" | "365d";

const PERIOD_LABELS: Record<Period, string> = {
  "30d":  "Last 30 days",
  "90d":  "Last 90 days",
  "365d": "Last 365 days",
};

// ─── Bar chart (pure CSS) ──────────────────────────────────────────────────────

function BarChart({
  data,
  barKey,
  secondKey,
  color = "bg-blue-500",
  secondColor = "bg-green-400",
  maxHeight = 80,
  label,
  secondLabel,
}: {
  data: (Record<string, number> & { date?: string })[];
  barKey: string;
  secondKey?: string;
  color?: string;
  secondColor?: string;
  maxHeight?: number;
  label: string;
  secondLabel?: string;
}) {
  const maxVal = Math.max(...data.map((d) => Math.max(d[barKey] ?? 0, d[secondKey ?? ""] ?? 0)), 1);

  return (
    <div>
      {secondKey && (
        <div className="flex items-center gap-4 mb-2 text-xs text-slate-500">
          <span className={`inline-block w-3 h-3 rounded-sm ${color}`} /> {label}
          <span className={`inline-block w-3 h-3 rounded-sm ${secondColor}`} /> {secondLabel}
        </div>
      )}
      <div className="flex items-end gap-0.5 h-20 overflow-x-auto">
        {data.map((d, i) => {
          const primary   = d[barKey]     ?? 0;
          const secondary = d[secondKey ?? ""] ?? 0;
          const ph = Math.round((primary   / maxVal) * maxHeight);
          const sh = Math.round((secondary / maxVal) * maxHeight);
          return (
            <div key={i} className="flex items-end gap-px flex-shrink-0" style={{ width: `${Math.max(2, 100 / data.length)}%` }}>
              <div
                className={`${color} rounded-t-sm w-full transition-all`}
                style={{ height: ph, minHeight: primary > 0 ? 2 : 0 }}
                title={`${d.date ?? ""}: ${formatCurrency(primary)}`}
              />
              {secondKey && (
                <div
                  className={`${secondColor} rounded-t-sm w-full transition-all`}
                  style={{ height: sh, minHeight: secondary > 0 ? 2 : 0 }}
                  title={`${d.date ?? ""}: ${formatCurrency(secondary)}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini stat card ────────────────────────────────────────────────────────────

function Stat({ label, value, sub, color = "text-slate-900" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Status breakdown bar ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  COMPLETED:  "bg-green-500",
  OPEN:       "bg-blue-500",
  PLANNED:    "bg-yellow-400",
  IN_PROGRESS:"bg-indigo-400",
  CANCELLED:  "bg-slate-300",
  NO_SHOW:    "bg-red-400",
  SCHEDULED:  "bg-blue-400",
};

function StatusBreakdown({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-xs text-slate-400">No data for this period.</p>;

  return (
    <div className="space-y-1.5">
      {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([status, n]) => (
        <div key={status} className="flex items-center gap-3">
          <div className="w-24 text-xs text-slate-600 capitalize">{status.replace("_", " ")}</div>
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`${STATUS_COLORS[status] ?? "bg-slate-400"} h-full rounded-full transition-all`}
              style={{ width: `${Math.round((n / total) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 w-10 text-right">{n}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [period,   setPeriod]  = useState<Period>("30d");
  const [data,     setData]    = useState<ReportData | null>(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState("");
  const [forbidden,setForbidden] = useState(false);

  const fetchReport = useCallback(async (p: Period) => {
    setLoading(true); setError("");
    const res = await fetch(`/api/reports?period=${p}`);
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? `Failed to load report (HTTP ${res.status})`);
      setLoading(false); return;
    }
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchReport(period); }, [period, fetchReport]);

  // ── Forbidden ──────────────────────────────────────────────────────────────
  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Reports" />
        <main className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-500 text-sm">You don't have permission to view reports.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline text-sm">Back to Dashboard</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Reports"
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]}
      />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Period selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Business Reports</h1>
            <p className="text-xs text-slate-500 mt-0.5">Revenue, patient activity, and clinical statistics.</p>
          </div>
          <div className="flex gap-1.5">
            {(["30d", "90d", "365d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  period === p
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map((n) => (
              <div key={n} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-20" />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Summary stat cards ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Stat
                label="Total Patients"
                value={String(data.summary.totalPatients)}
                sub="registered in org"
              />
              <Stat
                label={`Visits (${PERIOD_LABELS[period]})`}
                value={String(data.summary.periodVisits)}
                sub="excluding cancelled"
              />
              <Stat
                label="Billed"
                value={formatCurrency(data.summary.totalBilled)}
                sub="total amount raised"
              />
              <Stat
                label="Collected"
                value={formatCurrency(data.summary.totalCollected)}
                sub={`${data.summary.collectionRate}% collection rate`}
                color={data.summary.collectionRate >= 80 ? "text-green-700" : "text-orange-700"}
              />
              <Stat
                label="Outstanding"
                value={formatCurrency(data.summary.outstanding)}
                sub="open visits balance"
                color={data.summary.outstanding > 0 ? "text-red-700" : "text-green-700"}
              />
              <Stat
                label="Collection Rate"
                value={`${data.summary.collectionRate}%`}
                color={data.summary.collectionRate >= 90 ? "text-green-700" : data.summary.collectionRate >= 70 ? "text-yellow-700" : "text-red-700"}
              />
            </div>

            {/* ── Revenue chart ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Revenue — {PERIOD_LABELS[period]}</h2>
              <p className="text-xs text-slate-400 mb-4">Daily billed vs. collected. Each bar group = one day.</p>
              <BarChart
                data={data.revenueByDay as unknown as (Record<string, number> & { date?: string })[]}
                barKey="billed"
                secondKey="collected"
                color="bg-blue-300"
                secondColor="bg-green-500"
                label="Billed"
                secondLabel="Collected"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span>{data.revenueByDay[0]?.date}</span>
                <span>{data.revenueByDay[data.revenueByDay.length - 1]?.date}</span>
              </div>
            </div>

            {/* ── Two-column: New Patients + Status distributions ────────────── */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* New patient registrations */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-1">New Patient Registrations</h2>
                <p className="text-xs text-slate-400 mb-4">Patients registered per day in this period.</p>
                <BarChart
                  data={data.newPatients as unknown as (Record<string, number> & { date?: string })[]}
                  barKey="count"
                  color="bg-indigo-400"
                  label="New patients"
                />
              </div>

              {/* Visit status breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Visit Status Breakdown</h2>
                <StatusBreakdown data={data.visitsByStatus} />
              </div>

              {/* Appointment status */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Appointment Status Breakdown</h2>
                <StatusBreakdown data={data.apptByStatus} />
              </div>

              {/* Treatment status */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Treatment Plan Status</h2>
                <StatusBreakdown data={data.treatmentByStatus} />
              </div>
            </div>

            {/* ── Top procedures table ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Top Procedures</h2>
                <p className="text-xs text-slate-400 mt-0.5">By number of treatment plans created this period.</p>
              </div>
              {data.topProcedures.length === 0 ? (
                <p className="px-5 py-8 text-xs text-slate-400 text-center">No treatment records in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">#</th>
                      <th className="px-5 py-3 text-left font-medium">Procedure</th>
                      <th className="px-5 py-3 text-right font-medium">Plans</th>
                      <th className="px-5 py-3 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topProcedures.map((p, i) => (
                      <tr key={p.procedure} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-slate-800">{p.procedure}</td>
                        <td className="px-5 py-3 text-right text-slate-700">{p.count}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-900">{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
