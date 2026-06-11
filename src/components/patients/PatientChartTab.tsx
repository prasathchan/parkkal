"use client";

import Link from "next/link";
import { ToothChart, type ChartData } from "@/components/ui/ToothChart";
import type { ToothChartHistoryEntry } from "@/api/patients";

interface Props {
  chartData: ChartData;
  chartSaving: boolean;
  chartHistory: ToothChartHistoryEntry[];
  showHistory: boolean;
  onChartChange: (data: ChartData) => void;
  onToggleHistory: () => void;
}

export function PatientChartTab({ chartData, chartSaving, chartHistory, showHistory, onChartChange, onToggleHistory }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">FDI Dental Chart</h3>
          <p className="text-xs text-slate-500 mt-0.5">Click any tooth to record its condition. Changes save automatically.</p>
        </div>
        {chartSaving && <span className="text-xs text-slate-400 animate-pulse">Saving…</span>}
      </div>

      <ToothChart data={chartData} onChange={onChartChange} />

      {chartHistory.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onToggleHistory}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      {new Date(entry.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(entry.recordedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {entry.visitCode && (
                      <Link href={`/dashboard/visits/${entry.visitId}`} className="text-xs text-blue-600 hover:underline">
                        {entry.visitCode}
                      </Link>
                    )}
                    <span className="text-xs text-slate-500">by {entry.recordedByName}</span>
                  </div>
                  {entry.changedTeeth.length > 0 ? (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Changed:{" "}
                      {entry.changedTeeth.map((t) => (
                        <span key={t} className="inline-flex items-center px-1 rounded bg-slate-100 font-mono text-slate-700 mr-0.5">{t}</span>
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
  );
}
