import type { Appointment } from "@/types";
import { DEFAULT_DURATION_MIN, type Lane, type ViewMode } from "./types";

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseHour(time: string | null | undefined): number | null {
  if (!time) return null;
  const h = parseInt(time.split(":")[0], 10);
  return isNaN(h) ? null : h;
}

export function parseMinute(time: string | null | undefined): number {
  if (!time) return 0;
  const m = parseInt(time.split(":")[1], 10);
  return isNaN(m) ? 0 : m;
}

export function toTotalMinutes(time: string): number {
  return parseInt(time.split(":")[0], 10) * 60 + parseInt(time.split(":")[1], 10);
}

export function formatHourLabel(hour: number): string {
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function formatPeriodLabel(view: ViewMode, weekStart: Date, selectedDay: Date, monthStart: Date): string {
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
export function getMonthGridDates(monthStart: Date): Date[] {
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

/**
 * Assigns side-by-side columns to appointments that overlap in time.
 * Assumes DEFAULT_DURATION_MIN per appointment (no duration field in schema).
 * Returns a map from appointment id → { col, total }.
 */
export function computeLanes(appts: Appointment[]): Map<string, Lane> {
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

/** True if today's date falls within the given Mon–Sun week. */
export function isDateInWeek(date: Date, weekStart: Date): boolean {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const ds = toDateStr(date);
  return ds >= toDateStr(weekStart) && ds <= toDateStr(end);
}

/** True if today's date falls within the given month. */
export function isDateInMonth(date: Date, monthStart: Date): boolean {
  return date.getFullYear() === monthStart.getFullYear() && date.getMonth() === monthStart.getMonth();
}
