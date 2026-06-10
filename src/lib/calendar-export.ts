/**
 * lib/calendar-export.ts
 *
 * Generate "Add to Calendar" links for Google Calendar, Outlook (web), and
 * a downloadable .ics file (works with Apple Calendar, desktop Outlook,
 * Thunderbird — anything that supports the iCalendar standard).
 *
 * ─── HOW TO USE ──────────────────────────────────────────────────────────────
 *
 *   import { getCalendarLinks } from "@/lib/calendar-export";
 *
 *   const links = getCalendarLinks({
 *     title:    "Dental Appointment — Raj Kumar",
 *     date:     "2025-06-09",   // YYYY-MM-DD
 *     time:     "10:00",        // HH:MM (24h)
 *     duration: 30,             // minutes (default: 30)
 *     location: "City Dental, 12 Main Street",
 *     notes:    "Root canal review. Bring X-rays.",
 *   });
 *
 *   // links.google   → open in a new tab
 *   // links.outlook  → open in a new tab
 *   // links.download → call to trigger .ics file download
 *
 * ─── NO BACKEND REQUIRED ─────────────────────────────────────────────────────
 *
 *   Google and Outlook both accept deep-link URLs with event details as query
 *   params — no OAuth, no API keys needed. The .ics download is generated
 *   entirely in the browser using a Blob URL.
 *
 * ─── CLIENT-SIDE ONLY ────────────────────────────────────────────────────────
 *
 *   This file uses `window` / `document` (for .ics download) so it must only
 *   be called from client components ("use client"). It is safe to import in
 *   any file — the window check inside download() prevents SSR crashes.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEventParams {
  title:     string;
  date:      string;    // "YYYY-MM-DD"
  time:      string;    // "HH:MM" (24-hour)
  duration?: number;    // minutes, default 30
  location?: string;
  notes?:    string;
}

export interface CalendarLinks {
  /** Open Google Calendar in a new tab with the event pre-filled */
  google:   string;
  /** Open Outlook Web Calendar in a new tab with the event pre-filled */
  outlook:  string;
  /** Download a .ics file (works with Apple Calendar, desktop Outlook, etc.) */
  download: () => void;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** "2025-06-09" + "10:00" → Date object */
function toDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

/**
 * Format to Google Calendar / iCal format: "20250609T100000"
 * Google uses local time with no Z suffix; we add the user's local timezone.
 */
function toGoogleDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00"
  );
}

/** Format to iCal UTC: "20250609T043000Z" (converts local → UTC) */
function toICSDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

// ─── Google Calendar URL ──────────────────────────────────────────────────────

function buildGoogleUrl(params: CalendarEventParams): string {
  const start = toDate(params.date, params.time);
  const end   = new Date(start.getTime() + (params.duration ?? 30) * 60_000);

  const q = new URLSearchParams({
    action: "TEMPLATE",
    text:   params.title,
    dates:  `${toGoogleDate(start)}/${toGoogleDate(end)}`,
  });
  if (params.location) q.set("location", params.location);
  if (params.notes)    q.set("details",  params.notes);

  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// ─── Outlook Web URL ──────────────────────────────────────────────────────────

function buildOutlookUrl(params: CalendarEventParams): string {
  const start = toDate(params.date, params.time);
  const end   = new Date(start.getTime() + (params.duration ?? 30) * 60_000);

  // ISO 8601 local time — Outlook Web uses this format
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;

  const q = new URLSearchParams({
    path:     "/calendar/action/compose",
    rru:      "addevent",
    subject:  params.title,
    startdt:  fmt(start),
    enddt:    fmt(end),
  });
  if (params.location) q.set("location", params.location);
  if (params.notes)    q.set("body",     params.notes);

  return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}

// ─── .ics file download ───────────────────────────────────────────────────────

function buildICSContent(params: CalendarEventParams): string {
  const start = toDate(params.date, params.time);
  const end   = new Date(start.getTime() + (params.duration ?? 30) * 60_000);
  const uid   = `parkkal-${params.date}-${Date.now()}@parkkal.app`;

  // Fold long lines at 75 chars (RFC 5545 requirement)
  function fold(line: string): string {
    if (line.length <= 75) return line;
    const chunks: string[] = [];
    chunks.push(line.slice(0, 75));
    let i = 75;
    while (i < line.length) {
      chunks.push(" " + line.slice(i, i + 74));
      i += 74;
    }
    return chunks.join("\r\n");
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parkkal//Appointment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    fold(`UID:${uid}`),
    fold(`SUMMARY:${params.title}`),
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    params.location ? fold(`LOCATION:${params.location}`) : null,
    params.notes    ? fold(`DESCRIPTION:${params.notes.replace(/\n/g, "\\n")}`) : null,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return lines;
}

function downloadICS(params: CalendarEventParams): void {
  if (typeof window === "undefined") return; // SSR guard

  const content  = buildICSContent(params);
  const blob     = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url      = URL.createObjectURL(blob);
  const filename = `appointment-${params.date}.ics`;

  const a = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns Google, Outlook, and .ics download handlers for an appointment.
 * Call from any client component — no API keys or backend needed.
 */
export function getCalendarLinks(params: CalendarEventParams): CalendarLinks {
  return {
    google:   buildGoogleUrl(params),
    outlook:  buildOutlookUrl(params),
    download: () => downloadICS(params),
  };
}
