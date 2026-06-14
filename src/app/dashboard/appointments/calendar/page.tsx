"use client";

/**
 * /dashboard/appointments/calendar
 *
 * Week-view appointment calendar.
 *
 * ─── LAYOUT ──────────────────────────────────────────────────────────────────
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  Header: "Appointment Calendar"   [< Prev]  Week of Jun 9  [Next >] │
 *   │  Filters: Doctor dropdown                                           │
 *   ├──────┬──────────┬──────────┬──────────┬──────────┬──────────┬───────┤
 *   │ Time │  Mon     │  Tue     │  Wed     │  Thu     │  Fri     │  Sat  │
 *   │ 8 AM │          │ ●Patient │          │          │          │       │
 *   │ 9 AM │          │          │ ●Patient │          │          │       │
 *   │ ...  │          │          │          │          │          │       │
 *   │ 8 PM │          │          │          │          │          │       │
 *   └──────┴──────────┴──────────┴──────────┴──────────┴──────────┴───────┘
 *
 *   Click any appointment chip to open a detail sheet.
 *
 * ─── DATA FETCHING ───────────────────────────────────────────────────────────
 *
 *   Fetches all 7 days of the visible week in parallel (7 × GET /api/appointments?date=)
 *   Appointments without a time are shown in an "Unscheduled" strip at the top.
 *
 * ─── COLOR CODING ────────────────────────────────────────────────────────────
 *
 *   SCHEDULED  → blue
 *   CONFIRMED  → indigo
 *   COMPLETED  → green
 *   CANCELLED  → gray
 *   NO_SHOW    → red
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { appointmentsApi, ApiError } from "@/api";
import type { Appointment, AppointmentStatus } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_START = 8;   // 8 AM
const HOUR_END   = 20;  // 8 PM
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const DAYS       = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED:   "bg-pk-teal-100  text-pk-teal-800  border-pk-teal-200",
  CONFIRMED:   "bg-pk-teal-100 text-pk-teal-800 border-pk-teal-200",
  IN_PROGRESS: "bg-pk-teal-100   text-pk-teal-800   border-pk-teal-200",
  COMPLETED:   "bg-pk-success-fill text-pk-success-text border-pk-success-border",
  CANCELLED:   "bg-pk-surface-sunken  text-pk-text-muted  border-pk-border",
  NO_SHOW:     "bg-pk-danger-fill   text-pk-danger-text   border-pk-danger-border",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing the given date. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a Date as "YYYY-MM-DD". */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format a Date as "D MMM" (e.g. "9 Jun"). */
function formatDay(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Format a Date as "Month YYYY" (e.g. "June 2025"). */
function formatMonth(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** Parse "HH:MM" → hour number (or null). */
function parseHour(time: string | null | undefined): number | null {
  if (!time) return null;
  const h = parseInt(time.split(":")[0], 10);
  return isNaN(h) ? null : h;
}

/** Parse "HH:MM" → minute number. */
function parseMinute(time: string | null | undefined): number {
  if (!time) return 0;
  const m = parseInt(time.split(":")[1], 10);
  return isNaN(m) ? 0 : m;
}

/** Top offset inside a 60px hour slot (0–59px). */
function minuteOffset(time: string | null | undefined): number {
  return parseMinute(time);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [weekStart, setWeekStart]             = useState<Date>(() => getWeekStart(new Date()));
  const [appointmentsByDate, setByDate]        = useState<Map<string, Appointment[]>>(new Map());
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [selected, setSelected]               = useState<Appointment | null>(null);
  const [doctorFilter, setDoctorFilter]       = useState("");
  const [doctorOptions, setDoctorOptions]     = useState<{ id: string; name: string }[]>([]);

  // Build array of 7 Date objects for the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchWeek = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all 7 days in parallel
      const results = await Promise.all(
        weekDays.map((d) =>
          appointmentsApi.list({
            date:     toDateStr(d),
            doctorId: doctorFilter || undefined,
            limit:    200,
          })
        ),
      );

      const map = new Map<string, Appointment[]>();
      weekDays.forEach((d, i) => {
        map.set(toDateStr(d), results[i].appointments);
      });
      setByDate(map);

      // Build unique doctor list from all appointments (for filter dropdown)
      const seen = new Map<string, string>();
      for (const res of results) {
        for (const appt of res.appointments) {
          if (appt.doctorId && appt.doctorName && !seen.has(appt.doctorId)) {
            seen.set(appt.doctorId, appt.doctorName);
          }
        }
      }
      setDoctorOptions(Array.from(seen.entries()).map(([id, name]) => ({ id, name })));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, doctorFilter]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function prevWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function goToday() {
    setWeekStart(getWeekStart(new Date()));
  }

  const today = toDateStr(new Date());

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-pk-surface-raised">
      <Header title="Appointment Calendar" />

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-white border-b border-pk-border">
        {/* Week navigation */}
        <button
          onClick={prevWeek}
          className="p-1.5 rounded hover:bg-pk-surface-sunken text-pk-text-secondary"
          aria-label="Previous week"
        >
          ‹
        </button>
        <span className="font-medium text-sm text-pk-text-secondary min-w-[140px] text-center">
          {formatMonth(weekStart)}
        </span>
        <button
          onClick={nextWeek}
          className="p-1.5 rounded hover:bg-pk-surface-sunken text-pk-text-secondary"
          aria-label="Next week"
        >
          ›
        </button>

        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>

        {/* Doctor filter */}
        {doctorOptions.length > 0 && (
          <select
            className="ml-auto text-sm border border-pk-border-strong rounded-md px-3 py-1.5 bg-white"
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
          >
            <option value="">All Doctors</option>
            {doctorOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        <Link href="/dashboard/appointments/new">
          <Button size="sm">+ New Appointment</Button>
        </Link>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-6 mt-3 p-3 bg-pk-danger-fill border border-pk-danger-border rounded-lg text-pk-danger-text text-sm">
          {error}
        </div>
      )}

      {/* ── Calendar grid ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-4 pb-6">
        <div className="min-w-[800px]">
          {/* Day header row */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)] sticky top-0 z-10 bg-white border-b border-pk-border">
            <div /> {/* time gutter */}
            {weekDays.map((d, i) => {
              const ds   = toDateStr(d);
              const isToday = ds === today;
              return (
                <div
                  key={i}
                  className={`py-2 text-center text-sm border-l border-pk-border ${
                    isToday ? "bg-pk-teal-50" : ""
                  }`}
                >
                  <div className={`text-xs font-medium ${isToday ? "text-pk-teal-600" : "text-pk-text-muted"}`}>
                    {DAYS[i]}
                  </div>
                  <div className={`text-base font-semibold ${isToday ? "text-pk-teal-700" : "text-pk-text"}`}>
                    {formatDay(d)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unscheduled strip — appointments with no time */}
          {weekDays.some((d) => (appointmentsByDate.get(toDateStr(d)) ?? []).some((a) => !a.appointmentTime)) && (
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-pk-border bg-pk-warning-fill">
              <div className="py-1 px-2 text-[10px] text-pk-warning-text font-medium self-center">
                No time
              </div>
              {weekDays.map((d, i) => {
                const unscheduled = (appointmentsByDate.get(toDateStr(d)) ?? [])
                  .filter((a) => !a.appointmentTime);
                return (
                  <div key={i} className="border-l border-pk-border py-1 px-1 space-y-0.5 min-h-[28px]">
                    {unscheduled.map((appt) => (
                      <AppointmentChip
                        key={appt.id}
                        appt={appt}
                        onClick={() => setSelected(appt)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Time grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64 text-pk-text-muted text-sm">
              Loading…
            </div>
          ) : (
            HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-pk-border"
                style={{ height: 60 }}
              >
                {/* Hour label */}
                <div className="px-2 pt-1 text-[11px] text-pk-text-muted text-right leading-none">
                  {hour === 12 ? "12 PM" : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                </div>

                {/* Day columns */}
                {weekDays.map((d, i) => {
                  const dayAppts = (appointmentsByDate.get(toDateStr(d)) ?? [])
                    .filter((a) => parseHour(a.appointmentTime) === hour);
                  const isToday = toDateStr(d) === today;

                  return (
                    <div
                      key={i}
                      className={`relative border-l border-pk-border ${isToday ? "bg-pk-teal-50/30" : ""}`}
                    >
                      {dayAppts.map((appt) => (
                        <div
                          key={appt.id}
                          className="absolute left-0.5 right-0.5"
                          style={{ top: minuteOffset(appt.appointmentTime) }}
                        >
                          <AppointmentChip appt={appt} onClick={() => setSelected(appt)} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Detail sheet ───────────────────────────────────────────────────── */}
      {selected && (
        <AppointmentDetail appt={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Appointment chip ─────────────────────────────────────────────────────────

function AppointmentChip({
  appt,
  onClick,
}: {
  appt: Appointment;
  onClick: () => void;
}) {
  const colors = STATUS_COLORS[appt.status] ?? "bg-pk-surface-sunken text-pk-text-secondary border-pk-border";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded border truncate leading-snug ${colors} hover:opacity-80 transition-opacity`}
      title={`${appt.patientName ?? appt.patientId} — ${appt.appointmentTime ?? "No time"}`}
    >
      {appt.appointmentTime && (
        <span className="opacity-60 mr-1">{appt.appointmentTime}</span>
      )}
      {appt.patientName ?? appt.patientId}
    </button>
  );
}

// ─── Appointment detail sheet ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation",
  CHECKUP:      "Checkup",
  TREATMENT:    "Treatment",
  FOLLOWUP:     "Follow-up",
};

function AppointmentDetail({
  appt,
  onClose,
}: {
  appt: Appointment;
  onClose: () => void;
}) {
  const colors = STATUS_COLORS[appt.status] ?? "bg-pk-surface-sunken text-pk-text-secondary border-pk-border";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-xl z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-pk-border">
          <h2 className="font-semibold text-pk-text">Appointment</h2>
          <button
            onClick={onClose}
            className="text-pk-text-muted hover:text-pk-text-secondary text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Status badge */}
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors}`}>
            {appt.status}
          </span>

          {/* Patient */}
          <div>
            <p className="text-xs text-pk-text-muted mb-0.5">Patient</p>
            <p className="font-medium text-pk-text">{appt.patientName ?? appt.patientId}</p>
            {appt.patientCode && (
              <p className="text-xs text-pk-text-muted">{appt.patientCode}</p>
            )}
          </div>

          {/* Doctor */}
          {appt.doctorName && (
            <div>
              <p className="text-xs text-pk-text-muted mb-0.5">Doctor</p>
              <p className="font-medium text-pk-text">{appt.doctorName}</p>
            </div>
          )}

          {/* Date & Time */}
          <div>
            <p className="text-xs text-pk-text-muted mb-0.5">Date & Time</p>
            <p className="font-medium text-pk-text">
              {new Date(`${appt.appointmentDate}T00:00`).toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "short", year: "numeric",
              })}
            </p>
            <p className="text-sm text-pk-text-secondary">{appt.appointmentTime ?? "No time set"}</p>
          </div>

          {/* Type */}
          <div>
            <p className="text-xs text-pk-text-muted mb-0.5">Type</p>
            <p className="text-sm text-pk-text">{TYPE_LABELS[appt.type] ?? appt.type}</p>
          </div>

          {/* Notes */}
          {appt.notes && (
            <div>
              <p className="text-xs text-pk-text-muted mb-0.5">Notes</p>
              <p className="text-sm text-pk-text-secondary whitespace-pre-wrap">{appt.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <Link
              href={`/dashboard/appointments?highlight=${appt.id}`}
              className="block w-full text-center text-sm font-medium text-pk-teal-600 hover:text-pk-teal-700 py-2 border border-pk-teal-200 rounded-lg hover:bg-pk-teal-50 transition-colors"
              onClick={onClose}
            >
              View in List
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
