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
            <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={generateRecords}
            disabled={generating}
            className="mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {generating ? "Generating..." : "Generate Records"}
          </button>
        </div>

        {message && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg px-4 py-3 mb-4">
            {message}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Payroll</p>
            <p className="text-2xl font-bold text-slate-900">₹{totalPayroll.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Outstanding</p>
            <p className="text-2xl font-bold text-red-600">₹{outstanding.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No salary records for {month}.</p>
            <p className="text-sm mt-1">Click &ldquo;Generate Records&rdquo; to create them.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Staff Name</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Appts</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Paid</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.userName}</p>
                      <p className="text-xs text-slate-500">{r.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.salaryType}</td>
                    <td className="px-4 py-3 text-slate-700">{r.appointmentCount}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">₹{r.salaryAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-slate-700">₹{r.paidAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "PAID" ? "bg-green-100 text-green-700" : r.status === "PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status !== "PAID" && (
                        <button
                          onClick={() => markPaid(r)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
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
