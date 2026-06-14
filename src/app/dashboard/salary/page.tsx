"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { useAsync } from "@/hooks/use-async";
import { orgApi, ApiError } from "@/api";
import type { SalaryRecord } from "@/types";

export default function SalaryPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  const { data, loading, refetch } = useAsync(
    () => orgApi.salary.list(month),
    [month],
  );

  const records: SalaryRecord[] = data?.records ?? [];
  const totalPayroll  = records.reduce((s, r) => s + r.salaryAmount, 0);
  const totalPaid     = records.reduce((s, r) => s + r.paidAmount,   0);
  const outstanding   = totalPayroll - totalPaid;

  async function generateRecords() {
    setGenerating(true);
    setMessage("");
    try {
      const result = await orgApi.salary.generate(month) as { created?: number; records?: SalaryRecord[] };
      const created = (result as { created?: number }).created ?? result.records?.length ?? 0;
      setMessage(`Generated ${created} new salary records.`);
      refetch();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Failed to generate records");
    } finally {
      setGenerating(false);
    }
  }

  async function markPaid(record: SalaryRecord) {
    try {
      await orgApi.salary.update(record.id, {
        status: "PAID",
        paidAmount: record.salaryAmount,
      });
      refetch();
    } catch {
      // silently refetch — the optimistic state will correct itself
      refetch();
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Salary Management" breadcrumb={[{ label: "Dashboard" }, { label: "Salary" }]} />
      <main id="main-content" className="flex-1 p-6">
        {/* Controls */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-pk-text-secondary mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="border border-pk-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            />
          </div>
          <button
            onClick={generateRecords}
            disabled={generating}
            className="mt-5 bg-pk-teal-600 hover:bg-pk-teal-700 disabled:bg-pk-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {generating ? "Generating..." : "Generate Records"}
          </button>
        </div>

        {message && (
          <div className="bg-pk-teal-50 border border-pk-teal-200 text-pk-teal-700 text-sm rounded-lg px-4 py-3 mb-4">
            {message}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-pk-border p-4">
            <p className="text-xs text-pk-text-muted mb-1">Total Payroll</p>
            <p className="text-2xl font-bold text-pk-text">₹{totalPayroll.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white rounded-xl border border-pk-border p-4">
            <p className="text-xs text-pk-text-muted mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-pk-success-text">₹{totalPaid.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white rounded-xl border border-pk-border p-4">
            <p className="text-xs text-pk-text-muted mb-1">Outstanding</p>
            <p className="text-2xl font-bold text-pk-danger-text">₹{outstanding.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-pk-text-muted">Loading...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-pk-text-muted">
            <p>No salary records for {month}.</p>
            <p className="text-sm mt-1">Click &ldquo;Generate Records&rdquo; to create them.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-pk-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-pk-surface-raised border-b border-pk-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Staff Name</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Appts</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Paid</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pk-border">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-pk-surface-raised">
                    <td className="px-4 py-3">
                      <p className="font-medium text-pk-text">{r.userName}</p>
                      <p className="text-xs text-pk-text-muted">{r.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-pk-text-secondary">{r.salaryType}</td>
                    <td className="px-4 py-3 text-pk-text-secondary">{r.appointmentCount}</td>
                    <td className="px-4 py-3 font-medium text-pk-text">₹{r.salaryAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-pk-text-secondary">₹{r.paidAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "PAID" ? "bg-pk-success-fill text-pk-success-text" : r.status === "PARTIALLY_PAID" ? "bg-pk-warning-fill text-pk-warning-text" : "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status !== "PAID" && (
                        <button
                          onClick={() => markPaid(r)}
                          className="text-xs text-pk-teal-600 hover:text-pk-teal-800 font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
