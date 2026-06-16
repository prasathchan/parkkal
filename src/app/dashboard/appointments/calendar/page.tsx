"use client";

/**
 * /dashboard/appointments/calendar
 *
 * Advanced appointment calendar — three views (Month · Week · Day), live
 * current-time line, overlap lane splitting, click-to-book, zoom, quick
 * status changes, and keyboard navigation.
 *
 * ─── VIEWS ────────────────────────────────────────────────────────────────────
 *
 *   Month  — 6-week grid, appointment labels per day, click to jump to week
 *   Week   — 7 columns · time gutter · 8 AM–8 PM · 60/90/120 px per hour
 *   Day    — single wide column, same time grid
 *
 * ─── KEY FEATURES ─────────────────────────────────────────────────────────────
 *
 *   • Red "now" line — live, auto-updates every minute
 *   • Half-hour grid dashes
 *   • Zoom: 1× / 1.5× / 2× (hour row height)
 *   • Appointment-count badges in day headers
 *   • Overlap lane splitting — side-by-side chips when times collide
 *   • Chip height proportional to a 30-min default duration
 *   • Click empty cell → new appointment pre-filled with date + time
 *   • Status filter chips in toolbar
 *   • Doctor filter dropdown
 *   • Quick status change in detail sheet
 *   • Open Patient Record link in detail sheet
 *   • Keyboard: ← → navigate, T = today
 *   • Auto-scroll to current hour on load
 *   • Click day header (week view) → switch to day view
 *   • Click day cell (month view) → switch to week view
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { appointmentsApi, ApiError } from "@/api";
import type { Appointment, AppointmentStatus } from "@/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const HOUR_START = 8;
const HOUR_END   = 20;
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const WEEK_DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_DURATION_MIN = 30;

const STATUS_STYLE: Record<AppointmentStatus, { bg: string; text: string; border: string; bar: string; label: string }> = {
  SCHEDULED:   { bg: "bg-pk-info-fill",    text: "text-pk-info-text",    border: "border-pk-info-border",    bar: "bg-pk-info",    label: "Scheduled"    },
  CONFIRMED:   { bg: "bg-pk-teal-50",      text: "text-pk-teal-700",     border: "border-pk-teal-200",       bar: "bg-pk-teal-600", label: "Confirmed"    },
  IN_PROGRESS: { bg: "bg-pk-warning-fill", text: "text-pk-warning-text", border: "border-pk-warning-border", bar: "bg-pk-warning", label: "In Progress"  },
  COMPLETED:   { bg: "bg-pk-success-fill", text: "text-pk-success-text", border: "border-pk-success-border", bar: "bg-pk-success", label: "Completed"    },
  CANCELLED:   { bg: "bg-pk-neutral-150",  text: "text-pk-neutral-600",  border: "border-pk-neutral-300",    bar: "bg-pk-neutral-400", label: "Cancelled" },
  NO_SHOW:     { bg: "bg-pk-warning-fill", text: "text-pk-warning-text", border: "border-pk-warning-border", bar: "bg-pk-warning", label: "No Show"      },
};

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation",
  CHECKUP:      "Checkup",
  TREATMENT:    "Treatment",
  FOLLOWUP:     "Follow-up",
};

const STATUS_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  SCHEDULED:   ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED:   ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "NO_SHOW"],
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "",            label: "All"        },
  { value: "SCHEDULED",  label: "Scheduled"  },
  { value: "CONFIRMED",  label: "Confirmed"  },
  { value: "COMPLETED",  label: "Completed"  },
  { value: "CANCELLED",  label: "Cancelled"  },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

type ViewMode  = "month" | "week" | "day";
type ZoomLevel = 1 | 1.5 | 2;
interface Lane { col: number; total: number }

// ─── Date helpers ──────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseHour(time: string | null | undefined): number | null {
  if (!time) return null;
  const h = parseInt(time.split(":")[0], 10);
  return isNaN(h) ? null : h;
}

function parseMinute(time: string | null | undefined): number {
  if (!time) return 0;
  const m = parseInt(time.split(":")[1], 10);
  return isNaN(m) ? 0 : m;
}

function toTotalMinutes(time: string): number {
  return parseInt(time.split(":")[0], 10) * 60 + parseInt(time.split(":")[1], 10);
}

function formatHourLabel(hour: number): string {
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function formatPeriodLabel(view: ViewMode, weekStart: Date, selectedDay: Date, monthStart: Date): string {
  if (view === "day") {
    return selectedDay.toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "short", year: "numeric",
    });
  }
  if (view === "month") {
    return monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  return weekStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** Returns all dates in the Mon–Sun grid covering the full calendar month (up to 6 weeks). */
function getMonthGridDates(monthStart: Date): Date[] {
  const year  = monthStart.getFullYear();
  const month = monthStart.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth  = new Date(year, month + 1, 0);

  const gridStart = new Date(firstOfMonth);
  const s = gridStart.getDay();
  gridStart.setDate(gridStart.getDate() - (s === 0 ? 6 : s - 1));

  const gridEnd = new Date(lastOfMonth);
  const e = gridEnd.getDay();
  if (e !== 0) gridEnd.setDate(gridEnd.getDate() + (7 - e));

  const dates: Date[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Overlap lane algorithm ────────────────────────────────────────────────────

/**
 * Assigns side-by-side columns to appointments that overlap in time.
 * Assumes DEFAULT_DURATION_MIN per appointment (no duration field in schema).
 * Returns a map from appointment id → { col, total }.
 */
function computeLanes(appts: Appointment[]): Map<string, Lane> {
  const result = new Map<string, Lane>();
  const timed  = appts
    .filter(a => a.appointmentTime)
    .sort((a, b) => a.appointmentTime!.localeCompare(b.appointmentTime!));

  // Sweep-line: group overlapping appointments
  const groups: Appointment[][] = [];
  for (const appt of timed) {
    const start = toTotalMinutes(appt.appointmentTime!);
    let placed  = false;
    for (const group of groups) {
      const last    = group[group.length - 1];
      const lastEnd = toTotalMinutes(last.appointmentTime!) + DEFAULT_DURATION_MIN;
      if (start < lastEnd) { group.push(appt); placed = true; break; }
    }
    if (!placed) groups.push([appt]);
  }

  for (const group of groups) {
    group.forEach((appt, i) => result.set(appt.id, { col: i, total: group.length }));
  }
  return result;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [view, setView]                     = useState<ViewMode>("week");
  const [zoom, setZoom]                     = useState<ZoomLevel>(1);
  const [weekStart, setWeekStart]           = useState<Date>(() => getWeekStart(new Date()));
  const [selectedDay, setSelectedDay]       = useState<Date>(new Date());
  const [monthStart, setMonthStart]         = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [byDate, setByDate]                 = useState<Map<string, Appointment[]>>(new Map());
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [selected, setSelected]             = useState<Appointment | null>(null);
  const [doctorFilter, setDoctorFilter]     = useState("");
  const [statusFilter, setStatusFilter]     = useState("");
  const [doctorOptions, setDoctorOptions]   = useState<{ id: string; name: string }[]>([]);
  const [now, setNow]                       = useState(new Date());
  const [statusBusy, setStatusBusy]         = useState(false);

  const HOUR_HEIGHT  = Math.round(60 * zoom);
  const CHIP_HEIGHT  = Math.round((DEFAULT_DURATION_MIN / 60) * HOUR_HEIGHT);
  const today        = toDateStr(new Date());

  const weekDays       = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const monthGridDates = getMonthGridDates(monthStart);

  // ── Live clock ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Keyboard nav (refs so the listener is registered once) ─────────────────

  const stateRef = useRef({ view, weekStart, selectedDay, monthStart });
  stateRef.current = { view, weekStart, selectedDay, monthStart };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const { view: v } = stateRef.current;
      if (e.key === "ArrowLeft")               goRelative(-1);
      else if (e.key === "ArrowRight")         goRelative(+1);
      else if (e.key === "t" || e.key === "T") goToday();
      void v;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────

  const fetchDates = useCallback(async (dates: Date[]) => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        dates.map(d => appointmentsApi.list({ date: toDateStr(d), doctorId: doctorFilter || undefined, limit: 200 }))
      );
      setByDate(prev => {
        const next = new Map(prev);
        dates.forEach((d, i) => next.set(toDateStr(d), results[i].appointments));
        return next;
      });
      const seen = new Map<string, string>();
      for (const res of results)
        for (const a of res.appointments)
          if (a.doctorId && a.doctorName && !seen.has(a.doctorId)) seen.set(a.doctorId, a.doctorName);
      setDoctorOptions(Array.from(seen.entries()).map(([id, name]) => ({ id, name })));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [doctorFilter]);

  useEffect(() => {
    if (view === "week")        fetchDates(weekDays);
    else if (view === "day")    fetchDates([selectedDay]);
    else                        fetchDates(monthGridDates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, weekStart, selectedDay, monthStart, doctorFilter]);

  // Scroll to ~1 hour before current time on first load
  useEffect(() => {
    if (!loading && scrollRef.current && view !== "month") {
      const top = Math.max(0, (now.getHours() - HOUR_START - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = top;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goRelative(delta: number) {
    const { view: v, weekStart: ws, selectedDay: sd, monthStart: ms } = stateRef.current;
    if (v === "week") setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + delta * 7); return n; });
    else if (v === "day") setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() + delta); return n; });
    else setMonthStart(new Date(ms.getFullYear(), ms.getMonth() + delta, 1));
    void ws; void sd;
  }

  function goToday() {
    const t = new Date();
    setWeekStart(getWeekStart(t));
    setSelectedDay(t);
    setMonthStart(new Date(t.getFullYear(), t.getMonth(), 1));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getAppts(dateStr: string): Appointment[] {
    return (byDate.get(dateStr) ?? []).filter(a => !statusFilter || a.status === statusFilter);
  }

  function handleCellClick(dateStr: string, hour: number) {
    const time = `${String(hour).padStart(2, "0")}:00`;
    router.push(`/dashboard/appointments/new?date=${dateStr}&time=${time}`);
  }

  async function handleStatusChange(newStatus: AppointmentStatus) {
    if (!selected || statusBusy) return;
    setStatusBusy(true);
    try {
      const { appointment } = await appointmentsApi.updateStatus(selected.id, newStatus);
      setByDate(prev => {
        const next = new Map(prev);
        const list = next.get(appointment.appointmentDate) ?? [];
        next.set(appointment.appointmentDate, list.map(a => a.id === appointment.id ? appointment : a));
        return next;
      });
      setSelected(appointment);
    } catch { /* silently ignore — UI stays open */ }
    finally { setStatusBusy(false); }
  }

  // Now-line position in px (from top of timed grid)
  const nowLineTop    = (now.getHours() - HOUR_START) * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;
  const nowVisible    = now.getHours() >= HOUR_START && now.getHours() < HOUR_END;
  const nowDateStr    = toDateStr(now);

  const gridCols = view === "week" ? weekDays : [selectedDay];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--pk-bg)" }}>
      <Header title="Appointment Calendar" />

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
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
        <button onClick={() => goRelative(-1)} className="p-1.5 rounded text-lg leading-none hover:bg-pk-surface-sunken" style={{ color: "var(--pk-text-secondary)" }} aria-label="Previous">‹</button>
        <span className="font-medium text-sm min-w-[190px] text-center" style={{ color: "var(--pk-text)" }}>
          {formatPeriodLabel(view, weekStart, selectedDay, monthStart)}
        </span>
        <button onClick={() => goRelative(+1)} className="p-1.5 rounded text-lg leading-none hover:bg-pk-surface-sunken" style={{ color: "var(--pk-text-secondary)" }} aria-label="Next">›</button>
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>

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

        <Link href="/dashboard/appointments/new">
          <Button size="sm">+ New</Button>
        </Link>
      </div>

      {/* Keyboard hint */}
      <div className="px-4 py-1 text-[11px] shrink-0" style={{ color: "var(--pk-text-muted)" }}>
        ← → navigate &nbsp;·&nbsp; T = today &nbsp;·&nbsp; click empty slot to book
      </div>

      {error && (
        <div className="mx-4 mb-1 px-3 py-2 text-sm rounded-pk-sm border shrink-0" style={{ background: "var(--pk-danger-fill)", borderColor: "var(--pk-danger-border)", color: "var(--pk-danger-text)" }}>
          {error}
        </div>
      )}

      {/* ── Month view ──────────────────────────────────────────────────────── */}
      {view === "month" && (
        <MonthView
          monthStart={monthStart}
          monthGridDates={monthGridDates}
          getAppts={getAppts}
          today={today}
          loading={loading}
          onDayClick={d => {
            setSelectedDay(d);
            setWeekStart(getWeekStart(d));
            setView("week");
          }}
        />
      )}

      {/* ── Week / Day view ─────────────────────────────────────────────────── */}
      {view !== "month" && (
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div style={{ minWidth: view === "week" ? 720 : 360 }}>

            {/* Day headers — sticky */}
            <div
              className="grid sticky top-0 z-20 border-b"
              style={{
                gridTemplateColumns: `64px repeat(${gridCols.length}, 1fr)`,
                background: "var(--pk-surface)",
                borderColor: "var(--pk-border)",
              }}
            >
              <div /> {/* gutter placeholder */}
              {gridCols.map((d, i) => {
                const ds      = toDateStr(d);
                const isToday = ds === today;
                const count   = getAppts(ds).filter(a => a.appointmentTime).length;
                return (
                  <div
                    key={i}
                    className={`py-2 text-center border-l select-none ${view === "week" ? "cursor-pointer hover:bg-pk-teal-50/60" : ""}`}
                    style={{ borderColor: "var(--pk-border)", background: isToday ? "var(--pk-teal-50)" : undefined }}
                    onClick={() => { if (view === "week") { setSelectedDay(d); setView("day"); } }}
                  >
                    <div className="text-[11px] font-medium uppercase" style={{ color: isToday ? "var(--pk-primary)" : "var(--pk-text-muted)" }}>
                      {view === "week" ? WEEK_DAYS[i] : d.toLocaleDateString("en-IN", { weekday: "short" })}
                    </div>
                    <div className="text-xl font-bold leading-tight" style={{ color: isToday ? "var(--pk-primary)" : "var(--pk-text)" }}>
                      {d.getDate()}
                    </div>
                    {count > 0 && (
                      <div className="text-[10px] font-medium" style={{ color: "var(--pk-primary)" }}>
                        {count} {count === 1 ? "appt" : "appts"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Unscheduled strip */}
            {gridCols.some(d => getAppts(toDateStr(d)).some(a => !a.appointmentTime)) && (
              <div
                className="grid border-b"
                style={{
                  gridTemplateColumns: `64px repeat(${gridCols.length}, 1fr)`,
                  borderColor: "var(--pk-border)",
                  background: "var(--pk-warning-fill)",
                }}
              >
                <div className="py-1 px-2 text-[10px] font-medium self-center" style={{ color: "var(--pk-warning-text)" }}>No time</div>
                {gridCols.map((d, i) => {
                  const unscheduled = getAppts(toDateStr(d)).filter(a => !a.appointmentTime);
                  return (
                    <div key={i} className="border-l py-1 px-1 space-y-0.5 min-h-[28px]" style={{ borderColor: "var(--pk-border)" }}>
                      {unscheduled.map(appt => (
                        <CompactChip key={appt.id} appt={appt} onClick={() => setSelected(appt)} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Time grid */}
            {loading ? (
              <div className="flex items-center justify-center h-48 text-sm" style={{ color: "var(--pk-text-muted)" }}>Loading…</div>
            ) : (
              <div className="relative">

                {/* Current-time red line */}
                {nowVisible && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: nowLineTop }}
                  >
                    <div className="w-16 flex justify-end pr-1 flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 border-t border-red-500" />
                  </div>
                )}

                {HOURS.map(hour => {
                  // Compute per-day lane assignments once per day (not per hour)
                  const dayLaneMap = new Map(
                    gridCols.map(d => {
                      const ds = toDateStr(d);
                      return [ds, computeLanes(getAppts(ds).filter(a => a.appointmentTime))] as [string, Map<string, Lane>];
                    })
                  );

                  return (
                    <div
                      key={hour}
                      className="grid border-b"
                      style={{
                        gridTemplateColumns: `64px repeat(${gridCols.length}, 1fr)`,
                        height: HOUR_HEIGHT,
                        borderColor: "var(--pk-border)",
                      }}
                    >
                      {/* Hour label */}
                      <div className="px-2 pt-1 text-[11px] text-right leading-none flex-shrink-0" style={{ color: "var(--pk-text-muted)" }}>
                        {formatHourLabel(hour)}
                      </div>

                      {/* Day columns */}
                      {gridCols.map((d, i) => {
                        const ds      = toDateStr(d);
                        const isToday = ds === today;
                        const isNowCol = ds === nowDateStr;
                        const hourAppts = getAppts(ds).filter(a => parseHour(a.appointmentTime) === hour);
                        const lanes     = dayLaneMap.get(ds)!;

                        return (
                          <div
                            key={i}
                            className="relative border-l cursor-pointer group"
                            style={{
                              borderColor: "var(--pk-border)",
                              background: isToday ? "rgba(13,148,136,0.025)" : undefined,
                            }}
                            onClick={() => handleCellClick(ds, hour)}
                            title={`Book at ${formatHourLabel(hour)} on ${ds}`}
                          >
                            {/* Half-hour dashed line */}
                            <div
                              className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
                              style={{ top: "50%", borderColor: "var(--pk-border)" }}
                            />

                            {/* Hover booking hint */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center justify-center">
                              <span className="text-[10px] font-medium" style={{ color: "var(--pk-text-muted)" }}>+ Book</span>
                            </div>

                            {/* Now-column subtle marker */}
                            {isNowCol && nowVisible && Math.floor((now.getHours() - HOUR_START) * HOUR_HEIGHT) === Math.floor((hour - HOUR_START) * HOUR_HEIGHT) && (
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-400 opacity-20 pointer-events-none" />
                            )}

                            {/* Appointment blocks */}
                            {hourAppts.map(appt => {
                              const lane      = lanes.get(appt.id) ?? { col: 0, total: 1 };
                              const minuteTop = (parseMinute(appt.appointmentTime) / 60) * HOUR_HEIGHT;
                              const widthPct  = 100 / lane.total;
                              const leftPct   = lane.col * widthPct;

                              return (
                                <div
                                  key={appt.id}
                                  className="absolute"
                                  style={{
                                    top:    minuteTop,
                                    left:   `calc(${leftPct}% + 2px)`,
                                    width:  `calc(${widthPct}% - 4px)`,
                                    height: CHIP_HEIGHT,
                                    zIndex: 10,
                                  }}
                                  onClick={e => { e.stopPropagation(); setSelected(appt); }}
                                >
                                  <AppointmentBlock appt={appt} chipHeight={CHIP_HEIGHT} />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail sheet ────────────────────────────────────────────────────── */}
      {selected && (
        <DetailSheet
          appt={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          statusBusy={statusBusy}
        />
      )}
    </div>
  );
}

// ─── Compact chip (unscheduled strip) ─────────────────────────────────────────

function CompactChip({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const s = STATUS_STYLE[appt.status];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded border truncate ${s.bg} ${s.text} ${s.border} hover:opacity-80 transition-opacity`}
      title={`${appt.patientName ?? appt.patientId}`}
    >
      {appt.patientName ?? appt.patientId}
    </button>
  );
}

// ─── Appointment block (time grid) ────────────────────────────────────────────

function AppointmentBlock({ appt, chipHeight }: { appt: Appointment; chipHeight: number }) {
  const s       = STATUS_STYLE[appt.status];
  const compact = chipHeight < 38;

  return (
    <div
      className={`h-full rounded-pk-sm border overflow-hidden flex flex-row cursor-pointer hover:brightness-95 transition-all ${s.bg} ${s.border}`}
      title={`${appt.patientName ?? appt.patientId} · ${appt.appointmentTime} · ${TYPE_LABELS[appt.type] ?? appt.type}`}
    >
      {/* Left status bar */}
      <div className={`w-1 flex-shrink-0 ${s.bar}`} />

      {/* Content */}
      <div className="flex-1 px-1 py-0.5 overflow-hidden min-w-0">
        <div className={`font-semibold truncate leading-tight ${s.text} ${compact ? "text-[10px]" : "text-[11px]"}`}>
          {appt.patientName ?? appt.patientId}
        </div>
        {!compact && (
          <>
            <div className={`truncate text-[10px] leading-tight ${s.text} opacity-70`}>
              {appt.appointmentTime} &middot; {TYPE_LABELS[appt.type] ?? appt.type}
            </div>
            {appt.doctorName && (
              <div className={`truncate text-[10px] leading-tight ${s.text} opacity-55`}>
                {appt.doctorName}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({
  monthStart,
  monthGridDates,
  getAppts,
  today,
  loading,
  onDayClick,
}: {
  monthStart:      Date;
  monthGridDates:  Date[];
  getAppts:        (ds: string) => Appointment[];
  today:           string;
  loading:         boolean;
  onDayClick:      (d: Date) => void;
}) {
  const currentMonth = monthStart.getMonth();
  const weeks        = monthGridDates.length / 7;

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1 uppercase" style={{ color: "var(--pk-text-muted)" }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {Array.from({ length: weeks }, (_, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {monthGridDates.slice(wi * 7, wi * 7 + 7).map((d, di) => {
            const ds             = toDateStr(d);
            const isToday        = ds === today;
            const inCurrentMonth = d.getMonth() === currentMonth;
            const appts          = getAppts(ds).filter(a => a.appointmentTime);

            return (
              <div
                key={di}
                onClick={() => onDayClick(d)}
                className="rounded-pk-sm border p-1.5 cursor-pointer transition-colors hover:shadow-sm min-h-[80px]"
                style={{
                  borderColor: isToday ? "var(--pk-primary)" : "var(--pk-border)",
                  background:  isToday
                    ? "var(--pk-teal-50)"
                    : inCurrentMonth
                    ? "var(--pk-surface)"
                    : "var(--pk-surface-sunken)",
                  opacity: inCurrentMonth ? 1 : 0.45,
                }}
              >
                {/* Date number */}
                <div
                  className="text-sm font-bold mb-1"
                  style={{ color: isToday ? "var(--pk-primary)" : "var(--pk-text)" }}
                >
                  {d.getDate()}
                </div>

                {/* Appointment previews */}
                {loading ? (
                  <div className="h-2.5 w-10 rounded animate-pulse" style={{ background: "var(--pk-border)" }} />
                ) : (
                  <div className="space-y-0.5">
                    {appts.slice(0, 3).map(a => {
                      const s = STATUS_STYLE[a.status];
                      return (
                        <div
                          key={a.id}
                          className={`text-[10px] truncate rounded px-1 py-px leading-snug ${s.bg} ${s.text}`}
                        >
                          {a.appointmentTime} {a.patientName ?? ""}
                        </div>
                      );
                    })}
                    {appts.length > 3 && (
                      <div className="text-[10px]" style={{ color: "var(--pk-text-muted)" }}>
                        +{appts.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function DetailSheet({
  appt,
  onClose,
  onStatusChange,
  statusBusy,
}: {
  appt:           Appointment;
  onClose:        () => void;
  onStatusChange: (s: AppointmentStatus) => void;
  statusBusy:     boolean;
}) {
  const s           = STATUS_STYLE[appt.status];
  const transitions = STATUS_TRANSITIONS[appt.status] ?? [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div
        className="fixed right-0 top-0 bottom-0 w-80 z-50 flex flex-col shadow-pk-e3 overflow-y-auto"
        style={{ background: "var(--pk-surface)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--pk-border)" }}>
          <h2 className="font-semibold" style={{ color: "var(--pk-text)" }}>Appointment</h2>
          <button
            onClick={onClose}
            className="text-lg leading-none hover:opacity-70 transition-opacity"
            style={{ color: "var(--pk-text-muted)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-4 space-y-4">

          {/* Status badge */}
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
            {s.label}
          </span>

          {/* Patient */}
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Patient</p>
            <p className="font-medium" style={{ color: "var(--pk-text)" }}>{appt.patientName ?? appt.patientId}</p>
            {appt.patientCode && <p className="text-xs" style={{ color: "var(--pk-text-muted)" }}>{appt.patientCode}</p>}
          </div>

          {/* Doctor */}
          {appt.doctorName && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Doctor</p>
              <p className="font-medium" style={{ color: "var(--pk-text)" }}>{appt.doctorName}</p>
            </div>
          )}

          {/* Date & Time */}
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Date & Time</p>
            <p className="font-medium" style={{ color: "var(--pk-text)" }}>
              {new Date(`${appt.appointmentDate}T00:00`).toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "short", year: "numeric",
              })}
            </p>
            <p className="text-sm" style={{ color: "var(--pk-text-secondary)" }}>
              {appt.appointmentTime ?? "No time set"}
            </p>
          </div>

          {/* Type */}
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Type</p>
            <p className="text-sm" style={{ color: "var(--pk-text)" }}>{TYPE_LABELS[appt.type] ?? appt.type}</p>
          </div>

          {/* Notes */}
          {appt.notes && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Notes</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--pk-text-secondary)" }}>{appt.notes}</p>
            </div>
          )}

          {/* Quick status transitions */}
          {transitions.length > 0 && (
            <div>
              <p className="text-xs mb-1.5" style={{ color: "var(--pk-text-muted)" }}>Quick Actions</p>
              <div className="flex flex-wrap gap-1.5">
                {transitions.map(newStatus => {
                  const ts = STATUS_STYLE[newStatus];
                  return (
                    <button
                      key={newStatus}
                      onClick={() => onStatusChange(newStatus)}
                      disabled={statusBusy}
                      className={`px-2.5 py-1 rounded-pk-sm text-xs font-medium border transition-colors disabled:opacity-50 ${ts.bg} ${ts.text} ${ts.border}`}
                    >
                      {statusBusy ? "…" : `Mark ${ts.label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t space-y-2 shrink-0" style={{ borderColor: "var(--pk-border)" }}>
          <Link
            href={`/dashboard/patients/${appt.patientId}`}
            className="block w-full text-center text-sm font-medium py-2 border rounded-pk-sm transition-colors hover:bg-pk-surface-sunken"
            style={{ borderColor: "var(--pk-border)", color: "var(--pk-text)" }}
            onClick={onClose}
          >
            Open Patient Record
          </Link>
          <Link
            href={`/dashboard/appointments?highlight=${appt.id}`}
            className="block w-full text-center text-sm font-medium py-2 rounded-pk-sm transition-colors"
            style={{ color: "var(--pk-primary)" }}
            onClick={onClose}
          >
            View in List →
          </Link>
        </div>
      </div>
    </>
  );
}
