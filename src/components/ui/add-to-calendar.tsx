"use client";

/**
 * components/ui/add-to-calendar.tsx
 *
 * Dropdown button that lets staff or patients add an appointment to their
 * personal calendar — Google, Outlook (web), or Apple/desktop (.ics file).
 *
 * USAGE:
 *   <AddToCalendar
 *     title="Dental Appointment — Raj Kumar"
 *     date="2025-06-09"
 *     time="10:00"
 *     duration={30}
 *     location="City Dental, 12 Main Street"
 *     notes="Root canal review"
 *   />
 *
 * Renders a single "Add to Calendar" button. On click it opens a small
 * dropdown with three options. No external libraries needed.
 */

import { useState, useRef, useEffect } from "react";
import { getCalendarLinks } from "@/lib/calendar-export";
import type { CalendarEventParams } from "@/lib/calendar-export";

// ─── Icons ────────────────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ─── Calendar-provider logos (inline SVGs — no external images needed) ────────

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="3" fill="#0078D4"/>
      <path fill="white" d="M7 6h4.5C13.43 6 15 7.57 15 9.5S13.43 13 11.5 13H9v4H7V6zm2 5h2.5c.83 0 1.5-.67 1.5-1.5S12.33 8 11.5 8H9v3zM16 8h1v10h-1z"/>
      <path fill="white" d="M17 8l3 2v6l-3 2V8z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AddToCalendarProps extends CalendarEventParams {
  /** Button size variant */
  size?: "sm" | "md";
}

export function AddToCalendar({ size = "md", ...eventParams }: AddToCalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const links = getCalendarLinks(eventParams);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const btnClass =
    size === "sm"
      ? "inline-flex items-center gap-1.5 rounded-md border border-pk-border bg-pk-surface px-2.5 py-1.5 text-xs font-medium text-pk-text-secondary shadow-sm hover:bg-pk-surface-raised transition-colors"
      : "inline-flex items-center gap-2 rounded-lg border border-pk-border bg-pk-surface px-3.5 py-2 text-sm font-medium text-pk-text-secondary shadow-sm hover:bg-pk-surface-raised transition-colors";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={btnClass}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <CalendarIcon />
        Add to Calendar
        <ChevronDown />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-52 origin-top-right rounded-xl border border-pk-border bg-pk-surface shadow-lg ring-1 ring-black/5 focus:outline-none"
        >
          <div className="p-1.5 space-y-0.5">
            {/* Google Calendar */}
            <a
              href={links.google}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-pk-text-secondary hover:bg-pk-surface-raised transition-colors"
            >
              <GoogleIcon />
              <span>Google Calendar</span>
            </a>

            {/* Outlook Web */}
            <a
              href={links.outlook}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-pk-text-secondary hover:bg-pk-surface-raised transition-colors"
            >
              <OutlookIcon />
              <span>Outlook</span>
            </a>

            <div className="my-1 border-t border-pk-border" />

            {/* .ics download (Apple Calendar / desktop Outlook) */}
            <button
              type="button"
              role="menuitem"
              onClick={() => { links.download(); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-pk-text-secondary hover:bg-pk-surface-raised transition-colors"
            >
              <AppleIcon />
              <span>Apple / Other (.ics)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
