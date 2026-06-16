"use client";

/**
 * /dashboard/appointments/calendar
 *
 * The single appointments view — three calendar views (Month · Week · Day),
 * live current-time line, overlap lane splitting, click-to-book, zoom, quick
 * status changes, keyboard navigation, and a collapsible queue panel for
 * whichever date is currently selected.
 *
 * ─── VIEWS ────────────────────────────────────────────────────────────────────
 *
 *   Month  — 6-week grid, appointment labels per day, click to jump to week
 *   Week   — 7 columns · time gutter · 8 AM–8 PM · 60/90/120 px per hour
 *   Day    — single wide column, same time grid
 *
 * ─── SELECTED DAY ─────────────────────────────────────────────────────────────
 *
 *   `selectedDay` is the single source of truth for "which date is active" —
 *   it drives the queue panel in every view. Day view is always in sync with
 *   it trivially. In Week view, clicking a day header sets it without
 *   switching views. In Month view, clicking a day sets it and drills into
 *   that week. Navigating periods (prev/next/today) re-anchors it to "today"
 *   if today is visible in the new range, else the first day of that range.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { appointmentsApi, ApiError } from "@/api";
import type { Appointment, AppointmentStatus } from "@/types";
import { HOUR_START, type ViewMode, type ZoomLevel } from "./types";
import {
  getWeekStart, toDateStr, getMonthGridDates, formatPeriodLabel,
  isDateInWeek, isDateInMonth,
} from "./date-utils";
import { CalendarToolbar } from "./CalendarToolbar";
import { MonthView } from "./MonthView";
import { TimeGrid } from "./TimeGrid";
import { DayQueue } from "./DayQueue";
import { DetailSheet } from "./DetailSheet";

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
  const [showQueue, setShowQueue]           = useState(true);

  const HOUR_HEIGHT  = Math.round(60 * zoom);
  const CHIP_HEIGHT  = Math.round((30 / 60) * HOUR_HEIGHT);
  const today        = toDateStr(new Date());
  const selectedDateStr = toDateStr(selectedDay);

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
      if (e.key === "ArrowLeft")               goRelative(-1);
      else if (e.key === "ArrowRight")         goRelative(+1);
      else if (e.key === "t" || e.key === "T") goToday();
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
      // Single range request instead of one request per visible date — a 42-day
      // month grid used to fire 42 parallel requests, which could exhaust D1
      // connections / Worker concurrency and surface as an intermittent 503.
      const sorted    = [...dates].sort((a, b) => a.getTime() - b.getTime());
      const startDate = toDateStr(sorted[0]);
      const endDate    = toDateStr(sorted[sorted.length - 1]);
      const { appointments: appts } = await appointmentsApi.list({
        startDate, endDate,
        doctorId: doctorFilter || undefined,
        limit: 500,
      });

      const byDateInRange = new Map<string, Appointment[]>();
      for (const a of appts) {
        const list = byDateInRange.get(a.appointmentDate) ?? [];
        list.push(a);
        byDateInRange.set(a.appointmentDate, list);
      }

      setByDate(prev => {
        const next = new Map(prev);
        dates.forEach(d => next.set(toDateStr(d), byDateInRange.get(toDateStr(d)) ?? []));
        return next;
      });

      const seen = new Map<string, string>();
      for (const a of appts)
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
    const { view: v, weekStart: ws, monthStart: ms } = stateRef.current;
    const t = new Date();

    if (v === "week") {
      const newStart = new Date(ws);
      newStart.setDate(newStart.getDate() + delta * 7);
      setWeekStart(newStart);
      setSelectedDay(isDateInWeek(t, newStart) ? t : newStart);
    } else if (v === "day") {
      setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() + delta); return n; });
    } else {
      const newMonth = new Date(ms.getFullYear(), ms.getMonth() + delta, 1);
      setMonthStart(newMonth);
      setSelectedDay(isDateInMonth(t, newMonth) ? t : newMonth);
    }
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

  const nowDateStr = toDateStr(now);
  const gridCols   = view === "week" ? weekDays : [selectedDay];
  const queueAppts = getAppts(selectedDateStr);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--pk-bg)" }}>
      <Header title="Appointment Calendar" />

      <CalendarToolbar
        view={view}
        setView={setView}
        periodLabel={formatPeriodLabel(view, weekStart, selectedDay, monthStart)}
        onPrev={() => goRelative(-1)}
        onNext={() => goRelative(+1)}
        onToday={goToday}
        zoom={zoom}
        setZoom={setZoom}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        doctorFilter={doctorFilter}
        setDoctorFilter={setDoctorFilter}
        doctorOptions={doctorOptions}
        showQueue={showQueue}
        onToggleQueue={() => setShowQueue(s => !s)}
      />

      {/* Booking hint */}
      <div className="px-4 py-1 text-[11px] shrink-0" style={{ color: "var(--pk-text-muted)" }}>
        click empty slot to book
      </div>

      {error && (
        <div className="mx-4 mb-1 px-3 py-2 text-sm rounded-pk-sm border shrink-0" style={{ background: "var(--pk-danger-fill)", borderColor: "var(--pk-danger-border)", color: "var(--pk-danger-text)" }}>
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {view === "month" ? (
          <MonthView
            monthStart={monthStart}
            monthGridDates={monthGridDates}
            getAppts={getAppts}
            today={today}
            selectedDateStr={selectedDateStr}
            loading={loading}
            onDayClick={d => {
              setSelectedDay(d);
              setWeekStart(getWeekStart(d));
              setView("week");
            }}
          />
        ) : (
          <TimeGrid
            scrollRef={scrollRef}
            view={view}
            gridCols={gridCols}
            getAppts={getAppts}
            today={today}
            selectedDateStr={selectedDateStr}
            nowDateStr={nowDateStr}
            now={now}
            hourHeight={HOUR_HEIGHT}
            chipHeight={CHIP_HEIGHT}
            loading={loading}
            onDayHeaderClick={d => setSelectedDay(d)}
            onCellClick={handleCellClick}
            onAppointmentClick={setSelected}
          />
        )}

        {showQueue && (
          <DayQueue
            date={selectedDay}
            isToday={selectedDateStr === today}
            appointments={queueAppts}
            onAppointmentClick={setSelected}
          />
        )}
      </div>

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
