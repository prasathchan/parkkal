"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import { useAsync } from "@/hooks/use-async";
import { reportsApi } from "@/api";
import type { ReportData } from "@/types";
import type { ReportPeriod, ReportParams } from "@/api/reports";

// ─── SVG bar chart ─────────────────────────────────────────────────────────────

function SvgBarChart({
  data,
  barKey,
  secondKey,
  color = "#3b82f6",
  secondColor = "#22c55e",
  label,
  secondLabel,
  formatValue = (v: number) => String(v),
}: {
  data: (Record<string, number> & { date?: string })[];
  barKey: string;
  secondKey?: string;
  color?: string;
  secondColor?: string;
  label: string;
  secondLabel?: string;
  formatValue?: (v: number) => string;
}) {
  const W = 800, H = 100, PAD = 4;
  const maxVal = Math.max(...data.map((d) => Math.max(d[barKey] ?? 0, d[secondKey ?? ""] ?? 0)), 1);
  const n = data.length;
  const groupW = (W - PAD * 2) / Math.max(n, 1);
  const cols = secondKey ? 2 : 1;
  const barW = Math.max(1, (groupW - 1) / cols - 0.5);

  return (
    <div>
      {secondKey && (
        <div className="flex items-center gap-4 mb-2 text-xs text-slate-500">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} /> {label}
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: secondColor }} /> {secondLabel}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        {data.map((d, i) => {
          const primary   = d[barKey]           ?? 0;
          const secondary = d[secondKey ?? ""]  ?? 0;
          const ph = primary   > 0 ? Math.max(2, Math.round((primary   / maxVal) * (H - 4))) : 0;
          const sh = secondary > 0 ? Math.max(2, Math.round((secondary / maxVal) * (H - 4))) : 0;
          const x0 = PAD + i * groupW;
          return (
            <g key={i}>
              <rect
                x={x0}
                y={H - ph}
                width={barW}
                height={ph}
                fill={color}
                rx={1}
              >
                <title>{`${d.date ?? ""}: ${formatValue(primary)}`}</title>
              </rect>
              {secondKey && (
                <rect
                  x={x0 + barW + 0.5}
                  y={H - sh}
                  width={barW}
                  height={sh}
                  fill={secondColor}
                  rx={1}
                >
                  <title>{`${d.date ?? ""}: ${formatValue(secondary)}`}</title>
                </rect>
              )}
            </g>
          );
        })}
      </svg>
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
  COMPLETED:   "bg-green-500",
  OPEN:        "bg-blue-500",
  PLANNED:     "bg-yellow-400",
  IN_PROGRESS: "bg-indigo-400",
  CANCELLED:   "bg-slate-300",
  NO_SHOW:     "bg-red-400",
  SCHEDULED:   "bg-blue-400",
};

function StatusBreakdown({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-xs text-slate-400">No data for this period.</p>;
  return (
    <div className="space-y-1.5">
      {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([status, n]) => (
        <div key={status} className="flex items-center gap-3">
          <div className="w-24 text-xs text-slate-600 capitalize">{status.replace(/_/g, " ")}</div>
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

// ─── Period selector ───────────────────────────────────────────────────────────

const PRESET_LABELS: Record<string, string> = {
  "7d":   "7 days",
  "30d":  "30 days",
  "90d":  "90 days",
  "365d": "1 year",
};

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toLocaleDateString("en-CA");
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [period, setPeriod]     = useState<ReportPeriod>("30d");
  const [fromDate, setFromDate] = useState<string>(daysAgo(29));
  const [toDate,   setToDate]   = useState<string>(today());
  const [useCustom, setUseCustom] = useState(false);

  const params: ReportParams = useCustom
    ? { period: "custom", from: fromDate, to: toDate }
    : { period };

  const { data, loading, error } = useAsync<ReportData>(
    () => reportsApi.get(params),
    [period, useCustom, useCustom ? fromDate : "", useCustom ? toDate : ""],
  );

  const forbidden = (error ?? "").includes("403") || (error ?? "").toLowerCase().includes("permission");

  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Reports" />
        <main className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-500 text-sm">You don&apos;t have permission to view reports.</p>
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

        {/* ── Period selector ───────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Business Reports</h1>
            <p className="text-xs text-slate-500 mt-0.5">Revenue, patient activity, and clinical statistics.</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Preset buttons */}
            {(["7d", "30d", "90d", "365d"] as ReportPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setUseCustom(false); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  !useCustom && period === p
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}

            {/* Custom range toggle */}
            <button
              onClick={() => setUseCustom((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                useCustom
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Custom
            </button>

            {/* Date inputs — only shown when custom is active */}
            {useCustom && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-400 text-sm">–</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={today()}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {error && !forbidden && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
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
              <Stat label="Total Patients" value={String(data.summary.totalPatients)} sub="registered in org" />
              <Stat label="Visits (period)" value={String(data.summary.periodVisits)} sub="excl. cancelled" />
              <Stat label="Billed" value={formatCurrency(data.summary.totalBilled)} sub="total amount raised" />
              <Stat
                label="Collected"
                value={formatCurrency(data.summary.totalCollected)}
                sub={`${data.summary.collectionRate}% of billed`}
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
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Revenue — {data.period.label}</h2>
              <p className="text-xs text-slate-400 mb-4">Daily billed vs. collected.</p>
              <SvgBarChart
                data={data.revenueByDay as unknown as (Record<string, number> & { date?: string })[]}
                barKey="billed"
                secondKey="collected"
                color="#93c5fd"
                secondColor="#22c55e"
                label="Billed"
                secondLabel="Collected"
                formatValue={formatCurrency}
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{data.revenueByDay[0]?.date}</span>
                <span>{data.revenueByDay[data.revenueByDay.length - 1]?.date}</span>
              </div>
            </div>

            {/* ── Two-column: New Patients + Status distributions ────────────── */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-1">New Patient Registrations</h2>
                <p className="text-xs text-slate-400 mb-4">Patients registered per day.</p>
                <SvgBarChart
                  data={data.newPatients as unknown as (Record<string, number> & { date?: string })[]}
                  barKey="count"
                  color="#818cf8"
                  label="New patients"
                  formatValue={(v) => `${v} patient${v !== 1 ? "s" : ""}`}
                />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Visit Status Breakdown</h2>
                <StatusBreakdown data={data.visitsByStatus} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Appointment Status Breakdown</h2>
                <StatusBreakdown data={data.apptByStatus} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Treatment Plan Status</h2>
                <StatusBreakdown data={data.treatmentByStatus} />
              </div>
            </div>

            {/* ── Per-doctor breakdown ──────────────────────────────────────── */}
            {data.doctorBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">Doctor Performance</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Visits, billing, and collection per doctor this period.</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Doctor</th>
                      <th className="px-5 py-3 text-right font-medium">Visits</th>
                      <th className="px-5 py-3 text-right font-medium">Billed</th>
                      <th className="px-5 py-3 text-right font-medium">Collected</th>
                      <th className="px-5 py-3 text-right font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.doctorBreakdown.map((d) => {
                      const rate = d.billed > 0 ? Math.round((d.collected / d.billed) * 100) : 100;
                      return (
                        <tr key={d.doctorId} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-800">{d.doctorName}</td>
                          <td className="px-5 py-3 text-right text-slate-700">{d.visits}</td>
                          <td className="px-5 py-3 text-right text-slate-700">{formatCurrency(d.billed)}</td>
                          <td className="px-5 py-3 text-right text-slate-700">{formatCurrency(d.collected)}</td>
                          <td className={`px-5 py-3 text-right font-medium ${rate >= 90 ? "text-green-700" : rate >= 70 ? "text-yellow-700" : "text-red-700"}`}>
                            {rate}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Top procedures table ──────────────────────────────────────── */}
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
