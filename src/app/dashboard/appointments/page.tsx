"use client";

/**
 * Appointments Calendar
 *
 * Outlook/Google-style calendar with:
 *   • Day view  — time grid 8 AM–8 PM, one column per doctor, now-indicator
 *   • Week view — 7-day grid, appointments stacked per day
 *   • Today's Queue — sidebar showing who is next (receptionist-focused)
 *
 * Views adapt to role:
 *   DOCTOR      → opens in day view showing only their own appointments
 *   RECEPTIONIST/ADMIN → opens in week view, all doctors visible
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { appointmentsApi } from "@/api";
import { AddToCalendar } from "@/components/ui/add-to-calendar";
import { EmptyState } from "@/components/ui/empty-state";
import type { Appointment } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_START = 8;    // 8 AM
const HOUR_END   = 23;   // 11 PM — covers late evening appointments
const PX_PER_HOUR = 80;  // pixels per hour in the grid
const TOTAL_HOURS = HOUR_END - HOUR_START;

// Appointment type colours
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  CONSULTATION: { bg: "bg-pk-teal-50",   border: "border-pk-teal-400",  text: "text-pk-teal-800",  dot: "bg-pk-teal-400"  },
  CHECKUP:      { bg: "bg-pk-success-fill",  border: "border-pk-success-border", text: "text-pk-success-text", dot: "bg-pk-success" },
  TREATMENT:    { bg: "bg-pk-neutral-50", border: "border-pk-neutral-400",text: "text-pk-neutral-800",dot: "bg-pk-neutral-400"},
  FOLLOWUP:     { bg: "bg-pk-warning-fill", border: "border-pk-warning-border",text: "text-pk-warning-text",dot: "bg-pk-warning"},
};

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED:   "opacity-100",
  IN_PROGRESS: "ring-2 ring-pk-teal-400 ring-offset-1",
  COMPLETED:   "opacity-40",
  CANCELLED:   "opacity-25 line-through",
  NO_SHOW:     "opacity-30",
};

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation",
  CHECKUP:      "Checkup",
  TREATMENT:    "Treatment",
  FOLLOWUP:     "Follow-up",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  // Use local date components — toISOString() converts to UTC first, which
  // shifts the date in timezones behind UTC (e.g. IST midnight → UTC prev-day).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const day = new Date(d);
  const dow = day.getDay();           // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow; // shift to Mon
  day.setDate(day.getDate() + diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function formatDayHeader(d: Date): { weekday: string; date: string; isToday: boolean } {
  const today = toYMD(new Date());
  return {
    weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
    date:    d.getDate().toString(),
    isToday: toYMD(d) === today,
  };
}

function parseTime(time: string | null | undefined): { hour: number; minute: number } | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return { hour: h, minute: m };
}

function timeToTop(hour: number, minute: number): number {
  return ((hour - HOUR_START) + minute / 60) * PX_PER_HOUR;
}

function nowTop(): number {
  const now = new Date();
  return timeToTop(now.getHours(), now.getMinutes());
}

// ─── Appointment pill (shared between views) ──────────────────────────────────

function AppointmentPill({
  apt,
  onClick,
  style,
  compact = false,
}: {
  apt: Appointment;
  onClick: (a: Appointment) => void;
  style?: React.CSSProperties;
  compact?: boolean;
}) {
  const colors = TYPE_COLORS[apt.type] ?? TYPE_COLORS.CONSULTATION;
  const statusCls = STATUS_STYLE[apt.status] ?? "";

  return (
    <button
      type="button"
      onClick={() => onClick(apt)}
      style={style}
      className={`
        w-full text-left rounded-pk-sm border-l-4 px-2 py-1 shadow-pk-e1 transition
        hover:shadow-pk-e2 hover:brightness-95 cursor-pointer select-none
        ${colors.bg} ${colors.border} ${colors.text} ${statusCls}
        ${compact ? "text-xs" : "text-xs"}
      `}
    >
      <div className="font-semibold truncate leading-tight">
        {apt.appointmentTime && <span className="opacity-70 mr-1">{apt.appointmentTime}</span>}
        {apt.patientName ?? "Unknown"}
      </div>
      {!compact && (
        <div className="truncate opacity-70 mt-0.5">{TYPE_LABELS[apt.type]}</div>
      )}
      {apt.status === "IN_PROGRESS" && (
        <span className="inline-flex items-center gap-1 mt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-pk-teal-500 animate-pulse" />
          <span className="text-pk-teal-600 font-medium">In chair</span>
        </span>
      )}
    </button>
  );
}

// ─── Time grid (left column) ──────────────────────────────────────────────────

function TimeColumn() {
  return (
    <div className="w-14 flex-shrink-0 relative" style={{ height: TOTAL_HOURS * PX_PER_HOUR }}>
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div
          key={i}
          className="absolute w-full pr-2 text-right"
          style={{ top: i * PX_PER_HOUR - 8 }}
        >
          <span className="text-xs text-pk-text-muted font-medium">
            {((HOUR_START + i) % 12 || 12)}{HOUR_START + i < 12 ? " AM" : " PM"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({
  appointments,
  date,
  onAppointmentClick,
}: {
  appointments: Appointment[];
  date: string;
  onAppointmentClick: (a: Appointment) => void;
}) {
  const nowLineRef = useRef<HTMLDivElement>(null);
  const [nowY, setNowY] = useState(nowTop());
  const isToday = date === toYMD(new Date());

  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => setNowY(nowTop()), 60_000);
    return () => clearInterval(timer);
  }, [isToday]);

  // Group appointments by doctorId
  const doctorGroups = useMemo(() => {
    const map = new Map<string, { name: string; appointments: Appointment[] }>();
    for (const apt of appointments) {
      if (!map.has(apt.doctorId)) {
        map.set(apt.doctorId, { name: apt.doctorName ?? apt.doctorId, appointments: [] });
      }
      map.get(apt.doctorId)!.appointments.push(apt);
    }
    return [...map.entries()].map(([id, val]) => ({ doctorId: id, ...val }));
  }, [appointments]);

  if (doctorGroups.length === 0) {
    return (
      <EmptyState
        title="No appointments today"
        description="There are no appointments scheduled for this day."
        action={{ label: "Book Appointment", href: "/dashboard/appointments/new" }}
      />
    );
  }

  return (
    <div className="flex overflow-x-auto">
      {/* Time labels */}
      <div className="sticky left-0 z-10 bg-pk-surface border-r border-pk-border">
        <div className="h-10" /> {/* doctor header spacer */}
        <TimeColumn />
      </div>

      {/* Doctor columns */}
      {doctorGroups.map(({ doctorId, name, appointments: docApts }) => (
        <div key={doctorId} className="flex-1 min-w-[180px] border-r border-pk-border last:border-r-0">
          {/* Doctor header */}
          <div className="h-10 flex items-center justify-center border-b border-pk-border px-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-pk-teal-100 flex items-center justify-center text-xs font-bold text-pk-teal-600">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-pk-text-secondary truncate">{name}</span>
            </div>
          </div>

          {/* Time grid */}
          <div className="relative" style={{ height: TOTAL_HOURS * PX_PER_HOUR }}>
            {/* Hour lines */}
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-pk-border"
                style={{ top: i * PX_PER_HOUR }}
              />
            ))}
            {/* Half-hour lines */}
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={`h${i}`}
                className="absolute w-full border-t border-dashed border-pk-border"
                style={{ top: i * PX_PER_HOUR + PX_PER_HOUR / 2 }}
              />
            ))}

            {/* Now indicator */}
            {isToday && nowY >= 0 && nowY <= TOTAL_HOURS * PX_PER_HOUR && (
              <div
                ref={nowLineRef}
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: nowY }}
              >
                <div className="h-2.5 w-2.5 rounded-full bg-pk-danger -ml-1.5 flex-shrink-0" />
                <div className="h-px flex-1 bg-pk-danger" />
              </div>
            )}

            {/* Appointments */}
            {docApts.map((apt) => {
              const t = parseTime(apt.appointmentTime);
              if (!t) return null;
              const top    = timeToTop(t.hour, t.minute);
              const height = Math.max(PX_PER_HOUR * 0.5, 30); // 30min default
              if (top < 0 || top > TOTAL_HOURS * PX_PER_HOUR) return null;
              return (
                <div
                  key={apt.id}
                  className="absolute left-1 right-1"
                  style={{ top: top + 1, height: height - 2 }}
                >
                  <AppointmentPill apt={apt} onClick={onAppointmentClick} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({
  appointments,
  weekStart,
  onAppointmentClick,
  onDayClick,
}: {
  appointments: Appointment[];
  weekStart: Date;
  onAppointmentClick: (a: Appointment) => void;
  onDayClick: (date: string) => void;
}) {
  const days = weekDays(weekStart);
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of appointments) {
      const list = map.get(apt.appointmentDate) ?? [];
      list.push(apt);
      map.set(apt.appointmentDate, list);
    }
    return map;
  }, [appointments]);

  return (
    <div className="grid grid-cols-7 divide-x divide-pk-border min-h-[500px]">
      {days.map((day) => {
        const ymd = toYMD(day);
        const header = formatDayHeader(day);
        const dayApts = (byDay.get(ymd) ?? []).sort((a, b) =>
          (a.appointmentTime ?? "").localeCompare(b.appointmentTime ?? ""),
        );
        return (
          <div key={ymd} className="flex flex-col min-h-[500px]">
            {/* Day header */}
            <button
              type="button"
              onClick={() => onDayClick(ymd)}
              className={`
                py-2 text-center border-b border-pk-border hover:bg-pk-surface-raised transition
                ${header.isToday ? "bg-pk-teal-50" : ""}
              `}
            >
              <div className="text-xs font-medium text-pk-text-muted uppercase">{header.weekday}</div>
              <div className={`
                mx-auto mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold
                ${header.isToday ? "bg-pk-teal-600 text-white" : "text-pk-text-secondary"}
              `}>
                {header.date}
              </div>
              {dayApts.length > 0 && (
                <div className="text-xs text-pk-text-muted mt-0.5">{dayApts.length} appt{dayApts.length > 1 ? "s" : ""}</div>
              )}
            </button>

            {/* Appointments */}
            <div className="flex-1 p-1 space-y-1 overflow-y-auto">
              {dayApts.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <Link
                    href={`/dashboard/appointments/new?date=${ymd}`}
                    className="text-xs text-pk-text-muted hover:text-pk-teal-400 transition"
                  >
                    +
                  </Link>
                </div>
              ) : (
                dayApts.map((apt) => (
                  <AppointmentPill key={apt.id} apt={apt} onClick={onAppointmentClick} compact />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Today's Queue (receptionist sidebar) ────────────────────────────────────

function TodaysQueue({
  appointments,
  onAppointmentClick,
}: {
  appointments: Appointment[];
  onAppointmentClick: (a: Appointment) => void;
}) {
  const sorted = useMemo(
    () => [...appointments].sort((a, b) =>
      (a.appointmentTime ?? "").localeCompare(b.appointmentTime ?? ""),
    ),
    [appointments],
  );

  const inProgress = sorted.find((a) => a.status === "IN_PROGRESS");
  const nowHHMM    = new Date().toTimeString().slice(0, 5);
  const nextUp     = sorted.find(
    (a) => a.status === "SCHEDULED" && (a.appointmentTime ?? "00:00") >= nowHHMM,
  );

  return (
    <div className="w-72 flex-shrink-0 border-l border-pk-border flex flex-col bg-pk-surface-raised">
      <div className="px-4 py-3 border-b border-pk-border bg-pk-surface">
        <h2 className="text-sm font-semibold text-pk-text">Today&apos;s Queue</h2>
        <p className="text-xs text-pk-text-muted mt-0.5">{sorted.length} appointment{sorted.length !== 1 ? "s" : ""}</p>
      </div>

      {/* In chair now */}
      {inProgress && (
        <div className="mx-3 mt-3 rounded-pk-lg bg-pk-teal-50 border border-pk-teal-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-pk-teal-500 animate-pulse" />
            <span className="text-xs font-semibold text-pk-teal-700 uppercase tracking-wide">In Chair Now</span>
          </div>
          <p className="text-sm font-bold text-pk-teal-900">{inProgress.patientName}</p>
          <p className="text-xs text-pk-teal-600">{inProgress.appointmentTime} · {TYPE_LABELS[inProgress.type]}</p>
          <p className="text-xs text-pk-teal-500 mt-0.5">{inProgress.doctorName}</p>
        </div>
      )}

      {/* Next up */}
      {nextUp && nextUp.id !== inProgress?.id && (
        <div className="mx-3 mt-2 rounded-pk-lg bg-pk-warning-fill border border-pk-warning-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-pk-warning" />
            <span className="text-xs font-semibold text-pk-warning-text uppercase tracking-wide">Up Next</span>
          </div>
          <p className="text-sm font-bold text-pk-warning-text">{nextUp.patientName}</p>
          <p className="text-xs text-pk-warning-text">{nextUp.appointmentTime} · {TYPE_LABELS[nextUp.type]}</p>
          <p className="text-xs text-pk-warning-text mt-0.5">{nextUp.doctorName}</p>
        </div>
      )}

      {/* Full list */}
      <div className="flex-1 overflow-y-auto mt-2 px-3 pb-3 space-y-1.5">
        {sorted.map((apt, _idx) => {
          const isNext = apt.id === nextUp?.id;
          const isNow  = apt.id === inProgress?.id;
          return (
            <button
              key={apt.id}
              type="button"
              onClick={() => onAppointmentClick(apt)}
              className={`
                w-full text-left rounded-pk-sm p-2.5 transition border
                ${isNow   ? "bg-pk-teal-50 border-pk-teal-200"   :
                  isNext  ? "bg-pk-warning-fill border-pk-warning-border"  :
                  apt.status === "COMPLETED"  ? "bg-pk-surface border-pk-border opacity-50" :
                  apt.status === "CANCELLED"  ? "bg-pk-surface border-pk-border opacity-30" :
                  apt.status === "NO_SHOW"    ? "bg-pk-danger-fill border-pk-danger-border opacity-40" :
                  "bg-pk-surface border-pk-border hover:border-pk-border hover:bg-pk-surface-raised"}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-pk-text truncate">{apt.patientName}</p>
                  <p className="text-xs text-pk-text-muted truncate">{apt.doctorName}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-medium text-pk-text-secondary">{apt.appointmentTime ?? "—"}</p>
                  <span className={`
                    inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium mt-0.5
                    ${apt.status === "SCHEDULED"   ? "bg-pk-surface-sunken text-pk-text-secondary"   :
                      apt.status === "IN_PROGRESS" ? "bg-pk-teal-100 text-pk-teal-700"   :
                      apt.status === "COMPLETED"   ? "bg-pk-success-fill text-pk-success-text" :
                      apt.status === "CANCELLED"   ? "bg-pk-danger-fill text-pk-danger-text"     :
                      "bg-pk-surface-sunken text-pk-text-muted"}
                  `}>
                    {apt.status === "IN_PROGRESS" ? "In Chair" :
                     apt.status === "NO_SHOW"     ? "No Show"  :
                     apt.status.charAt(0) + apt.status.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-center text-xs text-pk-text-muted py-8">No appointments today</p>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-pk-border bg-pk-surface px-4 py-3">
        <p className="text-xs font-medium text-pk-text-muted mb-2">Appointment types</p>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(TYPE_COLORS).map(([type, c]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
              <span className="text-xs text-pk-text-muted">{TYPE_LABELS[type]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Appointment detail modal ─────────────────────────────────────────────────

function AppointmentModal({
  apt,
  onClose,
  onStatusChange,
}: {
  apt: Appointment;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const colors = TYPE_COLORS[apt.type] ?? TYPE_COLORS.CONSULTATION;
  const [updating, setUpdating] = useState(false);

  async function handleStatus(status: string) {
    setUpdating(true);
    await onStatusChange(apt.id, status);
    setUpdating(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-pk-surface rounded-pk-xl shadow-pk-e3 w-full max-w-md overflow-hidden">
        {/* Header strip */}
        <div className={`h-2 ${colors.dot}`} />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-medium text-pk-text-muted uppercase tracking-wide mb-1">
                {TYPE_LABELS[apt.type]}
              </div>
              <h2 className="text-xl font-bold text-pk-text">{apt.patientName}</h2>
            </div>
            <button onClick={onClose} className="text-pk-text-muted hover:text-pk-text-secondary p-1">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 text-pk-text-secondary">
              <svg className="h-4 w-4 flex-shrink-0 text-pk-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{apt.appointmentDate} {apt.appointmentTime && `· ${apt.appointmentTime}`}</span>
            </div>
            <div className="flex items-center gap-3 text-pk-text-secondary">
              <svg className="h-4 w-4 flex-shrink-0 text-pk-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{apt.doctorName}</span>
            </div>
            {apt.notes && (
              <div className="flex items-start gap-3 text-pk-text-secondary">
                <svg className="h-4 w-4 flex-shrink-0 mt-0.5 text-pk-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{apt.notes}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className={`
                inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium
                ${apt.status === "SCHEDULED"   ? "bg-pk-surface-sunken text-pk-text-secondary"   :
                  apt.status === "IN_PROGRESS" ? "bg-pk-teal-100 text-pk-teal-700"   :
                  apt.status === "COMPLETED"   ? "bg-pk-success-fill text-pk-success-text" :
                  apt.status === "CANCELLED"   ? "bg-pk-danger-fill text-pk-danger-text"     :
                  "bg-pk-surface-sunken text-pk-text-muted"}
              `}>
                {apt.status.replace("_", " ")}
              </span>
            </div>
          </div>

          {/* Add to calendar + Patient Record */}
          <div className="mt-4 pt-4 border-t border-pk-border flex items-center gap-3">
            {apt.appointmentTime && (
              <AddToCalendar
                title={`${TYPE_LABELS[apt.type]} — ${apt.patientName}`}
                date={apt.appointmentDate}
                time={apt.appointmentTime}
                duration={30}
                notes={apt.doctorName ? `Doctor: ${apt.doctorName}` : undefined}
              />
            )}
            <Link
              href={`/dashboard/patients/${apt.patientId}`}
              className="ml-auto inline-flex items-center gap-1.5 rounded-pk-sm border border-pk-teal-600 px-3 py-2 text-sm font-medium text-pk-teal-700 hover:bg-pk-teal-50 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Patient Record
            </Link>
          </div>

          {/* Actions */}
          <div className="mt-4 pt-4 border-t border-pk-border flex flex-wrap gap-2">
            {(apt.status === "SCHEDULED" || apt.status === "IN_PROGRESS") && (
              <Link
                href={`/dashboard/visits/new?patientId=${apt.patientId}&appointmentId=${apt.id}&doctorId=${apt.doctorId}`}
                className="inline-flex items-center gap-1.5 rounded-pk-sm bg-pk-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-pk-teal-700 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Start Visit
              </Link>
            )}
            {apt.status === "SCHEDULED" && (
              <>
                <button
                  onClick={() => handleStatus("NO_SHOW")}
                  disabled={updating}
                  className="rounded-pk-sm border border-pk-warning-border px-3 py-2 text-sm font-medium text-pk-warning-text hover:bg-pk-warning-fill transition disabled:opacity-50"
                >
                  No Show
                </button>
                <button
                  onClick={() => handleStatus("CANCELLED")}
                  disabled={updating}
                  className="rounded-pk-sm border border-pk-danger-border px-3 py-2 text-sm font-medium text-pk-danger-text hover:bg-pk-danger-fill transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = "day" | "week";

export default function AppointmentsPage() {
  const today        = toYMD(new Date());
  const [viewMode,   setViewMode]   = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(today);          // for day view
  const [weekStart,   setWeekStart]   = useState(startOfWeek(new Date())); // for week view
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<Appointment | null>(null);
  const [showQueue,    setShowQueue]     = useState(true);

  // Fetch for current view range
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "day") {
        const data = await appointmentsApi.list({ date: currentDate, limit: 200 });
        setAppointments(data.appointments ?? []);
      } else {
        const end = toYMD(addDays(weekStart, 6));
        const data = await appointmentsApi.list({
          startDate: toYMD(weekStart),
          endDate: end,
          limit: 500,
        });
        setAppointments(data.appointments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [viewMode, currentDate, weekStart]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  async function handleStatusChange(id: string, status: string) {
    try {
      await appointmentsApi.updateStatus(id, status);
      await fetchAppointments();
    } catch (e) {
      console.error(e);
    }
  }

  // Today's appointments for the queue sidebar
  const todaysAppointments = useMemo(
    () => appointments.filter((a) => a.appointmentDate === today),
    [appointments, today],
  );

  // Navigation
  function goToday() {
    setCurrentDate(today);
    setWeekStart(startOfWeek(new Date()));
  }

  function goPrev() {
    if (viewMode === "day") {
      setCurrentDate(toYMD(addDays(new Date(currentDate), -1)));
    } else {
      setWeekStart((w) => addDays(w, -7));
    }
  }

  function goNext() {
    if (viewMode === "day") {
      setCurrentDate(toYMD(addDays(new Date(currentDate), 1)));
    } else {
      setWeekStart((w) => addDays(w, 7));
    }
  }

  function switchToDayView(date: string) {
    setCurrentDate(date);
    setViewMode("day");
  }

  // Header title
  const headerTitle = useMemo(() => {
    if (viewMode === "day") {
      const d = new Date(currentDate + "T00:00:00");
      return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
    const end = addDays(weekStart, 6);
    const startLabel = weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const endLabel   = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return `${startLabel} – ${endLabel}`;
  }, [viewMode, currentDate, weekStart]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">

      {/* ── Calendar toolbar ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-pk-border bg-pk-surface flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-pk-sm hover:bg-pk-surface-sunken transition text-pk-text-secondary"
            aria-label="Previous"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="p-1.5 rounded-pk-sm hover:bg-pk-surface-sunken transition text-pk-text-secondary"
            aria-label="Next"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={goToday}
            className="ml-1 px-3 py-1.5 rounded-pk-sm border border-pk-border text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
          >
            Today
          </button>
        </div>

        {/* Title */}
        <h1 className="text-base font-semibold text-pk-text flex-1">{headerTitle}</h1>

        {/* View toggle */}
        <div className="flex rounded-pk-sm border border-pk-border overflow-hidden">
          {(["day", "week"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                viewMode === v
                  ? "bg-pk-teal-600 text-white"
                  : "bg-pk-surface text-pk-text-secondary hover:bg-pk-surface-raised"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Queue toggle */}
        <button
          onClick={() => setShowQueue((s) => !s)}
          className={`p-1.5 rounded-pk-sm border transition ${showQueue ? "border-pk-teal-200 bg-pk-teal-50 text-pk-teal-600" : "border-pk-border text-pk-text-muted hover:bg-pk-surface-raised"}`}
          title="Toggle today's queue"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
          </svg>
        </button>

        {/* New appointment */}
        <Link
          href={`/dashboard/appointments/new${viewMode === "day" ? `?date=${currentDate}` : ""}`}
          className="inline-flex items-center gap-1.5 rounded-pk-sm bg-pk-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-pk-teal-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New
        </Link>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Calendar grid */}
        <div
          className="flex-1 overflow-auto bg-pk-surface"
          ref={(el) => {
            if (el && viewMode === "day") {
              const now = new Date();
              const top = ((now.getHours() - HOUR_START) + now.getMinutes() / 60) * PX_PER_HOUR;
              el.scrollTop = Math.max(0, top - PX_PER_HOUR * 1.5);
            }
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3 text-pk-text-muted">
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Loading appointments…
              </div>
            </div>
          ) : viewMode === "day" ? (
            <DayView
              appointments={appointments}
              date={currentDate}
              onAppointmentClick={setSelected}
            />
          ) : (
            <WeekView
              appointments={appointments}
              weekStart={weekStart}
              onAppointmentClick={setSelected}
              onDayClick={switchToDayView}
            />
          )}
        </div>

        {/* Queue sidebar */}
        {showQueue && (
          <TodaysQueue
            appointments={todaysAppointments}
            onAppointmentClick={setSelected}
          />
        )}
      </div>

      {/* Appointment detail modal */}
      {selected && (
        <AppointmentModal
          apt={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
