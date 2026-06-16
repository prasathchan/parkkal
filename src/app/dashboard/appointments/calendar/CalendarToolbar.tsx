import Link from "next/link";
import { Button } from "@/components/ui/button";
import { STATUS_FILTER_OPTIONS, type ViewMode, type ZoomLevel } from "./types";

export function CalendarToolbar({
  view,
  setView,
  periodLabel,
  onPrev,
  onNext,
  onToday,
  zoom,
  setZoom,
  statusFilter,
  setStatusFilter,
  doctorFilter,
  setDoctorFilter,
  doctorOptions,
  showQueue,
  onToggleQueue,
}: {
  view:            ViewMode;
  setView:         (v: ViewMode) => void;
  periodLabel:     string;
  onPrev:          () => void;
  onNext:          () => void;
  onToday:         () => void;
  zoom:            ZoomLevel;
  setZoom:         (z: ZoomLevel) => void;
  statusFilter:    string;
  setStatusFilter: (s: string) => void;
  doctorFilter:    string;
  setDoctorFilter: (id: string) => void;
  doctorOptions:   { id: string; name: string }[];
  showQueue:       boolean;
  onToggleQueue:   () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b shrink-0" style={{ background: "var(--pk-surface)", borderColor: "var(--pk-border)" }}>

      {/* View toggle */}
      <div className="flex rounded-pk-sm overflow-hidden border" style={{ borderColor: "var(--pk-border)" }}>
        {(["month", "week", "day"] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
            style={view === v
              ? { background: "var(--pk-primary)", color: "#fff" }
              : { background: "var(--pk-surface)", color: "var(--pk-text-muted)" }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      <button onClick={onPrev} className="p-1.5 rounded text-lg leading-none hover:bg-pk-surface-sunken" style={{ color: "var(--pk-text-secondary)" }} aria-label="Previous">‹</button>
      <span className="font-medium text-sm min-w-[190px] text-center" style={{ color: "var(--pk-text)" }}>
        {periodLabel}
      </span>
      <button onClick={onNext} className="p-1.5 rounded text-lg leading-none hover:bg-pk-surface-sunken" style={{ color: "var(--pk-text-secondary)" }} aria-label="Next">›</button>
      <Button variant="outline" size="sm" onClick={onToday}>Today</Button>

      {/* Zoom — only for time-grid views */}
      {view !== "month" && (
        <div className="flex items-center gap-1">
          {([1, 1.5, 2] as ZoomLevel[]).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className="px-2 py-1 text-xs rounded border transition-colors"
              style={zoom === z
                ? { background: "var(--pk-primary)", color: "#fff", borderColor: "var(--pk-primary)" }
                : { borderColor: "var(--pk-border)", color: "var(--pk-text-muted)", background: "var(--pk-surface)" }}
            >
              {z}×
            </button>
          ))}
        </div>
      )}

      {/* Status filter chips */}
      <div className="flex items-center gap-1 flex-wrap ml-auto">
        {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className="px-2.5 py-1 text-xs rounded-full border transition-colors"
            style={statusFilter === value
              ? { background: "var(--pk-primary)", color: "#fff", borderColor: "var(--pk-primary)" }
              : { borderColor: "var(--pk-border)", color: "var(--pk-text-muted)", background: "var(--pk-surface)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Doctor filter */}
      {doctorOptions.length > 0 && (
        <select
          value={doctorFilter}
          onChange={e => setDoctorFilter(e.target.value)}
          className="text-xs border rounded-pk-sm px-2 py-1.5"
          style={{ borderColor: "var(--pk-border)", background: "var(--pk-surface)", color: "var(--pk-text)" }}
        >
          <option value="">All Doctors</option>
          {doctorOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}

      {/* Queue toggle */}
      <button
        onClick={onToggleQueue}
        className={`p-1.5 rounded-pk-sm border transition ${showQueue ? "border-pk-teal-200 bg-pk-teal-50 text-pk-teal-600" : "border-pk-border text-pk-text-muted hover:bg-pk-surface-raised"}`}
        title="Toggle queue"
        aria-label="Toggle queue"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
        </svg>
      </button>

      <Link href="/dashboard/appointments/new">
        <Button size="sm">+ New</Button>
      </Link>
    </div>
  );
}
