"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import { useAsync } from "@/hooks/use-async";
import { reportsApi } from "@/api";
import type { ReportData } from "@/types";
import type { ReportPeriod, ReportParams } from "@/api/reports";
import type { AgingBucket, PatientFunnel } from "@/types/report";

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
        <div className="flex items-center gap-4 mb-2 text-xs text-pk-text-muted">
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

function _Stat({ label, value, sub, color = "text-pk-text" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-pk-border p-4">
      <p className="text-xs text-pk-text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-pk-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Status breakdown bar ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  COMPLETED:   "bg-green-500",
  OPEN:        "bg-pk-teal-500",
  PLANNED:     "bg-yellow-400",
  IN_PROGRESS: "bg-pk-teal-400",
  CANCELLED:   "bg-pk-neutral-300",
  NO_SHOW:     "bg-red-400",
  SCHEDULED:   "bg-pk-teal-400",
};

function StatusBreakdown({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-xs text-pk-text-muted">No data for this period.</p>;
  return (
    <div className="space-y-1.5">
      {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([status, n]) => (
        <div key={status} className="flex items-center gap-3">
          <div className="w-24 text-xs text-pk-text-secondary capitalize">{status.replace(/_/g, " ")}</div>
          <div className="flex-1 bg-pk-surface-sunken rounded-full h-2 overflow-hidden">
            <div
              className={`${STATUS_COLORS[status] ?? "bg-pk-neutral-400"} h-full rounded-full transition-all`}
              style={{ width: `${Math.round((n / total) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-pk-text-muted w-10 text-right">{n}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Period-over-period stat card ─────────────────────────────────────────────

function StatWithChange({ label, value, sub, prevValue, color = "text-pk-text", isRate = false }: {
  label: string; value: string; sub?: string; prevValue?: number; color?: string; isRate?: boolean;
}) {
  const current = parseFloat(value.replace(/[^0-9.-]/g, ""));
  const hasChange = prevValue !== undefined && !isNaN(current) && prevValue !== 0;
  const pct = hasChange ? Math.round(((current - prevValue) / Math.abs(prevValue)) * 100) : null;
  const up = pct !== null && pct > 0;
  return (
    <div className="bg-white rounded-xl border border-pk-border p-4">
      <p className="text-xs text-pk-text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {pct !== null && (
        <p className={`text-xs mt-0.5 ${up ? (isRate ? "text-red-500" : "text-green-600") : (isRate ? "text-green-600" : "text-red-500")}`}>
          {up ? "▲" : "▼"} {Math.abs(pct)}% vs prior period
        </p>
      )}
      {sub && !pct && <p className="text-xs text-pk-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Aging table ───────────────────────────────────────────────────────────────

function AgingTable({ buckets }: { buckets: AgingBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  if (total === 0) return <p className="text-xs text-pk-text-muted py-4 text-center">No outstanding balances.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[320px]">
        <thead className="bg-pk-surface-raised text-xs text-pk-text-muted uppercase tracking-wide">
          <tr>
            <th className="px-5 py-3 text-left font-medium">Age</th>
            <th className="px-5 py-3 text-right font-medium">Visits</th>
            <th className="px-5 py-3 text-right font-medium">Balance Due</th>
            <th className="px-5 py-3 text-right font-medium">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pk-border">
          {buckets.filter((b) => b.count > 0).map((b) => (
            <tr key={b.label} className="hover:bg-pk-surface-raised">
              <td className="px-5 py-3 font-medium text-pk-text">{b.label}</td>
              <td className="px-5 py-3 text-right text-pk-text-secondary">{b.count}</td>
              <td className="px-5 py-3 text-right font-semibold text-red-700">{formatCurrency(b.amount)}</td>
              <td className="px-5 py-3 text-right text-pk-text-muted">{Math.round((b.amount / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-pk-border">
          <tr>
            <td className="px-5 py-3 font-semibold text-pk-text">Total</td>
            <td className="px-5 py-3 text-right font-semibold">{buckets.reduce((s, b) => s + b.count, 0)}</td>
            <td className="px-5 py-3 text-right font-bold text-red-700">{formatCurrency(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Patient funnel ────────────────────────────────────────────────────────────

function FunnelChart({ funnel }: { funnel: PatientFunnel }) {
  const steps = [
    { label: "Registered",     value: funnel.registered },
    { label: "Had Visit",      value: funnel.hadVisit },
    { label: "Treatment Plan", value: funnel.hadTreatmentPlan },
    { label: "Invoice",        value: funnel.hadInvoice },
    { label: "Payment",        value: funnel.hadPayment },
  ];
  const max = steps[0].value || 1;
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = Math.round((step.value / max) * 100);
        const dropPct = i > 0 ? Math.round(((steps[i - 1].value - step.value) / Math.max(steps[i - 1].value, 1)) * 100) : 0;
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between mb-1 text-xs text-pk-text-secondary">
              <span className="font-medium">{step.label}</span>
              <span className="text-pk-text-muted">{step.value.toLocaleString("en-IN")}
                {i > 0 && dropPct > 0 && <span className="text-red-400 ml-1">−{dropPct}%</span>}
              </span>
            </div>
            <div className="h-5 bg-pk-surface-sunken rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-pk-teal-500 transition-all"
                style={{ width: `${pct}%`, opacity: 1 - i * 0.12 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CSV export helper ─────────────────────────────────────────────────────────

function exportCsv(data: ReportData, label: string) {
  const lines: string[] = [];

  lines.push(`# Parkkal Report — ${label}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("Metric,Value");
  lines.push(`Total Patients,${data.summary.totalPatients}`);
  lines.push(`Visits (period),${data.summary.periodVisits}`);
  lines.push(`Total Billed,${data.summary.totalBilled}`);
  lines.push(`Total Collected,${data.summary.totalCollected}`);
  lines.push(`Collection Rate,${data.summary.collectionRate}%`);
  lines.push(`Outstanding,${data.summary.outstanding}`);
  lines.push("");

  lines.push("## Revenue by Day");
  lines.push("Date,Billed,Collected");
  for (const r of data.revenueByDay) lines.push(`${r.date},${r.billed},${r.collected}`);
  lines.push("");

  lines.push("## Doctor Performance");
  lines.push("Doctor,Visits,Billed,Collected");
  for (const d of data.doctorBreakdown) lines.push(`"${d.doctorName}",${d.visits},${d.billed},${d.collected}`);
  lines.push("");

  lines.push("## Outstanding Aging");
  lines.push("Bucket,Visits,Amount");
  for (const b of data.agingBuckets) if (b.count > 0) lines.push(`"${b.label}",${b.count},${b.amount}`);

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `parkkal-report-${label.replace(/\s/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
      <div className="min-h-screen bg-pk-surface-raised">
        <Header title="Reports" />
        <main id="main-content" className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-pk-text-muted text-sm">You don&apos;t have permission to view reports.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-pk-teal-600 hover:underline text-sm">Back to Dashboard</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pk-surface-raised">
      <Header
        title="Reports"
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]}
      />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── Period selector ───────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-pk-text">Business Reports</h1>
            <p className="text-xs text-pk-text-muted mt-0.5">Revenue, patient activity, and clinical statistics.</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {data && (
              <button
                onClick={() => exportCsv(data, data.period.label)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-pk-border text-pk-text-secondary hover:bg-pk-surface-raised transition"
              >
                ↓ Export CSV
              </button>
            )}
            {/* Preset buttons */}
            {(["7d", "30d", "90d", "365d"] as ReportPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setUseCustom(false); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  !useCustom && period === p
                    ? "bg-pk-teal-600 text-white"
                    : "bg-white border border-pk-border text-pk-text-secondary hover:bg-pk-surface-raised"
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
                  ? "bg-pk-teal-600 text-white"
                  : "bg-white border border-pk-border text-pk-text-secondary hover:bg-pk-surface-raised"
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
                  className="border border-pk-border rounded-lg px-2 py-1.5 text-sm text-pk-text-secondary bg-white focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                />
                <span className="text-pk-text-muted text-sm">–</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={today()}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-pk-border rounded-lg px-2 py-1.5 text-sm text-pk-text-secondary bg-white focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
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
              <div key={n} className="bg-white rounded-xl border border-pk-border p-4 animate-pulse h-20" />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Summary stat cards with period-over-period ────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatWithChange label="Total Patients" value={String(data.summary.totalPatients)} sub="registered in org" />
              <StatWithChange
                label="Visits (period)"
                value={String(data.summary.periodVisits)}
                prevValue={data.prevSummary?.periodVisits}
              />
              <StatWithChange
                label="Billed"
                value={formatCurrency(data.summary.totalBilled)}
                prevValue={data.prevSummary?.totalBilled}
              />
              <StatWithChange
                label="Collected"
                value={formatCurrency(data.summary.totalCollected)}
                prevValue={data.prevSummary?.totalCollected}
                color={data.summary.collectionRate >= 80 ? "text-green-700" : "text-orange-700"}
              />
              <StatWithChange
                label="Outstanding"
                value={formatCurrency(data.summary.outstanding)}
                color={data.summary.outstanding > 0 ? "text-red-700" : "text-green-700"}
              />
              <StatWithChange
                label="Collection Rate"
                value={`${data.summary.collectionRate}%`}
                prevValue={data.prevSummary?.collectionRate}
                isRate
                color={data.summary.collectionRate >= 90 ? "text-green-700" : data.summary.collectionRate >= 70 ? "text-yellow-700" : "text-red-700"}
              />
            </div>

            {/* ── Revenue chart ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-pk-border p-5">
              <h2 className="text-sm font-semibold text-pk-text mb-1">Revenue — {data.period.label}</h2>
              <p className="text-xs text-pk-text-muted mb-4">Daily billed vs. collected.</p>
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
              <div className="flex justify-between text-xs text-pk-text-muted mt-1">
                <span>{data.revenueByDay[0]?.date}</span>
                <span>{data.revenueByDay[data.revenueByDay.length - 1]?.date}</span>
              </div>
            </div>

            {/* ── Two-column: New Patients + Status distributions ────────────── */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-pk-border p-5">
                <h2 className="text-sm font-semibold text-pk-text mb-1">New Patient Registrations</h2>
                <p className="text-xs text-pk-text-muted mb-4">Patients registered per day.</p>
                <SvgBarChart
                  data={data.newPatients as unknown as (Record<string, number> & { date?: string })[]}
                  barKey="count"
                  color="#818cf8"
                  label="New patients"
                  formatValue={(v) => `${v} patient${v !== 1 ? "s" : ""}`}
                />
              </div>
              <div className="bg-white rounded-xl border border-pk-border p-5">
                <h2 className="text-sm font-semibold text-pk-text mb-4">Visit Status Breakdown</h2>
                <StatusBreakdown data={data.visitsByStatus} />
              </div>
              <div className="bg-white rounded-xl border border-pk-border p-5">
                <h2 className="text-sm font-semibold text-pk-text mb-4">Appointment Status Breakdown</h2>
                <StatusBreakdown data={data.apptByStatus} />
              </div>
              <div className="bg-white rounded-xl border border-pk-border p-5">
                <h2 className="text-sm font-semibold text-pk-text mb-4">Treatment Plan Status</h2>
                <StatusBreakdown data={data.treatmentByStatus} />
              </div>
            </div>

            {/* ── Per-doctor breakdown ──────────────────────────────────────── */}
            {data.doctorBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-pk-border overflow-hidden">
                <div className="px-5 py-4 border-b border-pk-border">
                  <h2 className="text-sm font-semibold text-pk-text">Doctor Performance</h2>
                  <p className="text-xs text-pk-text-muted mt-0.5">Visits, billing, and collection per doctor this period.</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-pk-surface-raised text-xs text-pk-text-muted uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Doctor</th>
                      <th className="px-5 py-3 text-right font-medium">Visits</th>
                      <th className="px-5 py-3 text-right font-medium">Billed</th>
                      <th className="px-5 py-3 text-right font-medium">Collected</th>
                      <th className="px-5 py-3 text-right font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pk-border">
                    {data.doctorBreakdown.map((d) => {
                      const rate = d.billed > 0 ? Math.round((d.collected / d.billed) * 100) : 100;
                      return (
                        <tr key={d.doctorId} className="hover:bg-pk-surface-raised">
                          <td className="px-5 py-3 font-medium text-pk-text">{d.doctorName}</td>
                          <td className="px-5 py-3 text-right text-pk-text-secondary">{d.visits}</td>
                          <td className="px-5 py-3 text-right text-pk-text-secondary">{formatCurrency(d.billed)}</td>
                          <td className="px-5 py-3 text-right text-pk-text-secondary">{formatCurrency(d.collected)}</td>
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
            <div className="bg-white rounded-xl border border-pk-border overflow-hidden">
              <div className="px-5 py-4 border-b border-pk-border">
                <h2 className="text-sm font-semibold text-pk-text">Top Procedures</h2>
                <p className="text-xs text-pk-text-muted mt-0.5">By number of treatment plans created this period.</p>
              </div>
              {data.topProcedures.length === 0 ? (
                <p className="px-5 py-8 text-xs text-pk-text-muted text-center">No treatment records in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-pk-surface-raised text-xs text-pk-text-muted uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">#</th>
                      <th className="px-5 py-3 text-left font-medium">Procedure</th>
                      <th className="px-5 py-3 text-right font-medium">Plans</th>
                      <th className="px-5 py-3 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pk-border">
                    {data.topProcedures.map((p, i) => (
                      <tr key={p.procedure} className="hover:bg-pk-surface-raised">
                        <td className="px-5 py-3 text-pk-text-muted text-xs">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-pk-text">{p.procedure}</td>
                        <td className="px-5 py-3 text-right text-pk-text-secondary">{p.count}</td>
                        <td className="px-5 py-3 text-right font-medium text-pk-text">{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Outstanding balance aging ──────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-pk-border overflow-hidden">
              <div className="px-5 py-4 border-b border-pk-border">
                <h2 className="text-sm font-semibold text-pk-text">Outstanding Balance Aging</h2>
                <p className="text-xs text-pk-text-muted mt-0.5">Open visits bucketed by days since creation.</p>
              </div>
              <AgingTable buckets={data.agingBuckets} />
            </div>

            {/* ── Patient funnel ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-pk-border p-5">
              <h2 className="text-sm font-semibold text-pk-text mb-1">Patient Funnel</h2>
              <p className="text-xs text-pk-text-muted mb-4">Conversion from registration through payment (all-time).</p>
              <FunnelChart funnel={data.patientFunnel} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
