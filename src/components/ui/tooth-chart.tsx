"use client";

import { cn } from "@/lib/utils";

// FDI layout — displayed as dentist sees patient (mirror image)
// Upper row L→R: 18,17,16,15,14,13,12,11 | 21,22,23,24,25,26,27,28
// Lower row L→R: 48,47,46,45,44,43,42,41 | 31,32,33,34,35,36,37,38

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]; // Q1 — patient's upper right, drawn on left
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]; // Q2 — patient's upper left,  drawn on right
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]; // Q4 — patient's lower right, drawn on left
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]; // Q3 — patient's lower left,  drawn on right

type ToothType = "molar" | "premolar" | "canine" | "incisor";

function toothType(n: number): ToothType {
  const d = n % 10;
  if (d >= 6) return "molar";
  if (d === 4 || d === 5) return "premolar";
  if (d === 3) return "canine";
  return "incisor";
}

// SVG crown shapes (viewed from biting surface) — simplified but recognizable
const CROWN_PATHS: Record<ToothType, { w: number; h: number; path: string }> = {
  molar:    { w: 28, h: 28, path: "M4,4 Q14,2 24,4 Q26,14 24,24 Q14,26 4,24 Q2,14 4,4 Z M9,9 L19,9 L19,19 L9,19 Z" },
  premolar: { w: 24, h: 26, path: "M4,4 Q12,2 20,4 Q22,13 20,22 Q12,24 4,22 Q2,13 4,4 Z M9,9 L15,9 L15,17 L9,17 Z" },
  canine:   { w: 20, h: 28, path: "M5,5 Q10,1 15,5 Q18,12 15,22 Q10,26 5,22 Q2,12 5,5 Z" },
  incisor:  { w: 18, h: 26, path: "M3,5 Q9,2 15,5 Q17,13 15,21 Q9,24 3,21 Q1,13 3,5 Z" },
};

interface ToothProps {
  number: number;
  selected: boolean;
  onToggle?: (n: number) => void;
  readOnly?: boolean;
  upper: boolean;
}

function Tooth({ number, selected, onToggle, readOnly, upper }: ToothProps) {
  const type = toothType(number);
  const crown = CROWN_PATHS[type];

  return (
    <div
      className="flex flex-col items-center gap-0.5"
      style={{ width: crown.w + 4 }}
    >
      {/* Tooth number label — above for upper, below for lower */}
      {upper && (
        <span className="text-[9px] font-mono text-pk-text-muted leading-none">{number}</span>
      )}

      {/* Crown SVG */}
      <svg
        width={crown.w}
        height={crown.h}
        viewBox={`0 0 ${crown.w} ${crown.h}`}
        className={cn(
          "cursor-default transition-all duration-150",
          !readOnly && "cursor-pointer hover:scale-110"
        )}
        onClick={() => !readOnly && onToggle?.(number)}
        aria-label={`Tooth ${number}`}
        role={readOnly ? undefined : "checkbox"}
        aria-checked={selected}
      >
        <path
          d={crown.path}
          fill={selected ? "#0B6E6E" : "#FAF8F3"}
          stroke={selected ? "#0B5654" : "#B0A99B"}
          strokeWidth="1.5"
          className="transition-colors duration-150"
        />
      </svg>

      {!upper && (
        <span className="text-[9px] font-mono text-pk-text-muted leading-none">{number}</span>
      )}
    </div>
  );
}

export interface ToothChartProps {
  /** Controlled: array of FDI tooth number strings e.g. ["11", "21"] */
  value?: string[];
  onChange?: (teeth: string[]) => void;
  readOnly?: boolean;
  /** If true, renders a compact read-only badge list instead of the full chart */
  compact?: boolean;
  className?: string;
}

export function ToothChart({ value = [], onChange, readOnly = false, compact = false, className }: ToothChartProps) {
  const selected = new Set(value.map(String));

  function toggle(n: number) {
    const key = String(n);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange?.(Array.from(next).sort((a, b) => Number(a) - Number(b)));
  }

  if (compact) {
    if (selected.size === 0) return <span className="text-pk-text-muted text-xs">—</span>;
    return (
      <div className={cn("flex flex-wrap gap-1", className)}>
        {Array.from(selected).sort((a, b) => Number(a) - Number(b)).map(t => (
          <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded bg-pk-teal-100 text-pk-teal-800 text-xs font-mono">
            {t}
          </span>
        ))}
      </div>
    );
  }

  const row = (teeth: number[], upper: boolean) => (
    <div className="flex items-end gap-0.5">
      {teeth.map(n => (
        <Tooth
          key={n}
          number={n}
          selected={selected.has(String(n))}
          onToggle={toggle}
          readOnly={readOnly}
          upper={upper}
        />
      ))}
    </div>
  );

  return (
    <div className={cn("select-none", className)}>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-2 text-[10px] text-pk-text-muted">
        <span>Patient&apos;s upper right ← → upper left</span>
        {!readOnly && <span className="ml-auto">Click to select/deselect</span>}
      </div>

      <div className="border border-pk-border rounded-xl bg-pk-surface-raised p-3 inline-block">
        {/* Upper jaw */}
        <div className="flex items-end gap-px mb-1">
          {/* Q1 */}
          {row(UPPER_RIGHT, true)}
          {/* Midline */}
          <div className="w-px bg-pk-neutral-300 mx-1 self-stretch" />
          {/* Q2 */}
          {row(UPPER_LEFT, true)}
        </div>

        {/* Jaw separator */}
        <div className="flex items-center gap-1 my-1.5">
          <div className="flex-1 h-px bg-pk-surface-sunken" />
          <span className="text-[9px] text-pk-text-muted font-medium">UPPER / LOWER</span>
          <div className="flex-1 h-px bg-pk-surface-sunken" />
        </div>

        {/* Lower jaw */}
        <div className="flex items-start gap-px mt-1">
          {/* Q4 */}
          {row(LOWER_RIGHT, false)}
          {/* Midline */}
          <div className="w-px bg-pk-neutral-300 mx-1 self-stretch" />
          {/* Q3 */}
          {row(LOWER_LEFT, false)}
        </div>
      </div>

      {/* Selected summary */}
      {selected.size > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from(selected).sort((a, b) => Number(a) - Number(b)).map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pk-teal-100 text-pk-teal-800 text-xs font-mono">
              {t}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggle(Number(t))}
                  className="hover:text-pk-teal-600 leading-none"
                  aria-label={`Remove tooth ${t}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
