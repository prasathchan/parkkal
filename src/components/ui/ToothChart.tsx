"use client";

import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToothCondition =
  | "HEALTHY" | "CARIES" | "FILLING" | "CROWN" | "MISSING"
  | "ROOT_CANAL" | "BRIDGE" | "IMPLANT" | "FRACTURED" | "WATCH";

export interface ToothData {
  condition: ToothCondition;
  notes?: string;
}

export type ChartData = Partial<Record<string, ToothData>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_COLORS: Record<ToothCondition, { bg: string; border: string; text: string }> = {
  HEALTHY:    { bg: "#ffffff", border: "#cbd5e1", text: "#64748b" },
  CARIES:     { bg: "#fef2f2", border: "#ef4444", text: "#dc2626" },
  FILLING:    { bg: "#eff6ff", border: "#3b82f6", text: "#2563eb" },
  CROWN:      { bg: "#fefce8", border: "#eab308", text: "#ca8a04" },
  MISSING:    { bg: "#f1f5f9", border: "#94a3b8", text: "#64748b" },
  ROOT_CANAL: { bg: "#faf5ff", border: "#8b5cf6", text: "#7c3aed" },
  BRIDGE:     { bg: "#ecfeff", border: "#06b6d4", text: "#0891b2" },
  IMPLANT:    { bg: "#f0fdf4", border: "#22c55e", text: "#16a34a" },
  FRACTURED:  { bg: "#fff7ed", border: "#f97316", text: "#ea580c" },
  WATCH:      { bg: "#fffbeb", border: "#fbbf24", text: "#d97706" },
};

const CONDITION_LABELS: Record<ToothCondition, string> = {
  HEALTHY:    "Healthy",
  CARIES:     "Caries (Decay)",
  FILLING:    "Filling",
  CROWN:      "Crown",
  MISSING:    "Missing",
  ROOT_CANAL: "Root Canal",
  BRIDGE:     "Bridge",
  IMPLANT:    "Implant",
  FRACTURED:  "Fractured",
  WATCH:      "Watch",
};

const ALL_CONDITIONS = Object.keys(CONDITION_LABELS) as ToothCondition[];

// FDI layout — upper and lower rows from patient left to right
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToothType(n: number): "molar" | "premolar" | "canine" | "incisor" {
  const d = n % 10;
  if (d >= 6) return "molar";
  if (d === 4 || d === 5) return "premolar";
  if (d === 3) return "canine";
  return "incisor";
}

// ─── Single tooth cell ────────────────────────────────────────────────────────

function ToothCell({
  number,
  data,
  isUpper,
  readOnly,
  onConditionChange,
}: {
  number: number;
  data: ToothData | undefined;
  isUpper: boolean;
  readOnly: boolean;
  onConditionChange: (n: number, condition: ToothCondition, notes?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editNotes, setEditNotes] = useState(data?.notes ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const condition: ToothCondition = data?.condition ?? "HEALTHY";
  const colors = CONDITION_COLORS[condition];
  const type = getToothType(number);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const height = type === "molar" ? "h-10" : type === "premolar" ? "h-9" : "h-8";

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      {/* Tooth number label — above for upper, below for lower */}
      {isUpper && (
        <span className="text-[9px] text-slate-400 mb-0.5 leading-none select-none">{number}</span>
      )}

      {/* Tooth shape */}
      <button
        type="button"
        disabled={readOnly}
        title={CONDITION_LABELS[condition] + (data?.notes ? ` — ${data.notes}` : "")}
        onClick={() => { if (!readOnly) { setEditNotes(data?.notes ?? ""); setOpen(true); } }}
        className={`w-7 ${height} rounded-sm border-2 transition-all focus:outline-none relative ${readOnly ? "cursor-default" : "hover:scale-110 hover:z-10 cursor-pointer"}`}
        style={{ background: colors.bg, borderColor: colors.border }}
      >
        {condition === "MISSING" && (
          <span className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-bold">×</span>
        )}
        {condition === "ROOT_CANAL" && (
          <span className="absolute inset-0 flex items-center justify-center text-purple-400 text-[8px] font-bold">RC</span>
        )}
        {condition === "BRIDGE" && (
          <span className="absolute inset-0 flex items-center justify-center text-cyan-500 text-[8px] font-bold">BR</span>
        )}
        {condition === "IMPLANT" && (
          <span className="absolute inset-0 flex items-center justify-center text-green-600 text-[8px] font-bold">IM</span>
        )}
      </button>

      {!isUpper && (
        <span className="text-[9px] text-slate-400 mt-0.5 leading-none select-none">{number}</span>
      )}

      {/* Condition popover */}
      {open && (
        <div
          className={`absolute z-50 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 ${isUpper ? "top-full mt-1" : "bottom-full mb-1"} ${number <= 18 || (number >= 31 && number <= 38) ? "left-0" : "right-0"}`}
        >
          <p className="text-xs font-semibold text-slate-600 px-1 pb-1 border-b border-slate-100 mb-1">
            Tooth {number}
          </p>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {ALL_CONDITIONS.map((c) => {
              const col = CONDITION_COLORS[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onConditionChange(number, c, editNotes); setOpen(false); }}
                  className={`text-left text-xs px-2 py-1 rounded-lg border transition-all ${condition === c ? "ring-2 ring-offset-1" : "hover:opacity-80"}`}
                  style={{ background: col.bg, borderColor: col.border, color: col.text }}
                >
                  {CONDITION_LABELS[c]}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            onBlur={() => onConditionChange(number, condition, editNotes)}
            placeholder="Notes..."
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
      {ALL_CONDITIONS.map((c) => {
        const col = CONDITION_COLORS[c];
        return (
          <div key={c} className="flex items-center gap-1">
            <span
              className="w-3.5 h-3.5 rounded-sm border flex-shrink-0"
              style={{ background: col.bg, borderColor: col.border }}
            />
            <span className="text-[10px] text-slate-500">{CONDITION_LABELS[c]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ToothChart component ────────────────────────────────────────────────

interface ToothChartProps {
  data: ChartData;
  readOnly?: boolean;
  onChange?: (data: ChartData) => void;
}

export function ToothChart({ data, readOnly = false, onChange }: ToothChartProps) {
  function handleChange(n: number, condition: ToothCondition, notes?: string) {
    const updated: ChartData = {
      ...data,
      [String(n)]: { condition, notes: notes || undefined },
    };
    // Remove HEALTHY entries to keep the stored object compact
    if (condition === "HEALTHY" && !notes) delete updated[String(n)];
    onChange?.(updated);
  }

  return (
    <div className="w-full">
      {/* Chart grid — scrolls horizontally on very small screens */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[520px]">
          {/* Legend row */}
          <div className="flex justify-between text-[9px] text-slate-400 font-medium mb-1 px-1">
            <span>Patient&apos;s Right (Q1/Q4)</span>
            <span>Patient&apos;s Left (Q2/Q3)</span>
          </div>

          {/* Upper arch */}
          <div className="flex items-end gap-0.5 justify-center mb-1 pb-2 border-b border-dashed border-slate-200">
            {UPPER_TEETH.map((n, i) => (
              <>
                {i === 8 && <div key="midline-upper" className="w-2 flex-shrink-0" />}
                <ToothCell
                  key={n}
                  number={n}
                  data={data[String(n)]}
                  isUpper={true}
                  readOnly={readOnly}
                  onConditionChange={handleChange}
                />
              </>
            ))}
          </div>

          {/* Midline label */}
          <div className="text-center text-[9px] text-slate-300 py-0.5 select-none">
            — occlusal plane —
          </div>

          {/* Lower arch */}
          <div className="flex items-start gap-0.5 justify-center mt-1 pt-2 border-t border-dashed border-slate-200">
            {LOWER_TEETH.map((n, i) => (
              <>
                {i === 8 && <div key="midline-lower" className="w-2 flex-shrink-0" />}
                <ToothCell
                  key={n}
                  number={n}
                  data={data[String(n)]}
                  isUpper={false}
                  readOnly={readOnly}
                  onConditionChange={handleChange}
                />
              </>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <Legend />
    </div>
  );
}
