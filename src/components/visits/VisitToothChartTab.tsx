"use client";

import { useState, useEffect, useCallback } from "react";
import { patientsApi } from "@/api";
import { ToothChart, type ChartData } from "@/components/ui/ToothChart";
import type { VisitItem } from "./types";

interface Props {
  visitId: string;
  patientId: string;
  visitStatus: "OPEN" | "COMPLETED" | "CANCELLED";
  items: VisitItem[];
}

export function VisitToothChartTab({ visitId, patientId, visitStatus, items }: Props) {
  const [chartData, setChartData] = useState<ChartData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Teeth referenced in this visit's bill items — shown as a hint
  const billedTeeth = Array.from(
    new Set(
      items
        .map((i) => i.toothNumber?.trim())
        .filter((t): t is string => t !== undefined && t !== null && /^[1-4][1-8]$/.test(t))
    )
  ).sort((a, b) => Number(a) - Number(b));

  const readOnly = visitStatus === "CANCELLED";

  useEffect(() => {
    patientsApi.getToothChart(patientId)
      .then((d) => setChartData((d.toothData as ChartData) ?? {}))
      .catch(() => setError("Failed to load tooth chart"))
      .finally(() => setLoading(false));
  }, [patientId]);

  const handleChange = useCallback(async (data: ChartData) => {
    setChartData(data);
    setSaving(true);
    setError("");
    try {
      await patientsApi.saveToothChart(patientId, data as Record<string, unknown>, visitId);
      setSavedAt(Date.now());
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [patientId, visitId]);

  if (loading) {
    return <p className="text-sm text-slate-400 py-6 text-center">Loading chart…</p>;
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">FDI Dental Chart</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {readOnly
              ? "Visit is cancelled — chart is read-only."
              : "Click any tooth to update its condition. Changes are saved immediately and linked to this visit."}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {saving && <p className="text-xs text-slate-400 animate-pulse">Saving…</p>}
          {!saving && savedAt && (
            <p className="text-xs text-green-600">
              Saved {new Date(savedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Visit teeth hint */}
      {billedTeeth.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            This visit&apos;s bill references{" "}
            <span className="font-semibold">
              {billedTeeth.length === 1 ? `tooth ${billedTeeth[0]}` : `teeth ${billedTeeth.join(", ")}`}
            </span>
            {" "}— update their conditions below after treatment.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}

      <ToothChart data={chartData} readOnly={readOnly} onChange={handleChange} />
    </div>
  );
}
