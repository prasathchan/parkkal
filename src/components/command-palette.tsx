"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCommandPalette } from "@/context/command-palette-context";
import { patientsApi, visitsApi } from "@/api";
import { useDebounce } from "@/hooks/use-debounce";
import type { Patient } from "@/types";

interface NavResult {
  type: "nav";
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
}

interface PatientResult {
  type: "patient";
  id: string;
  label: string;
  description: string;
  href: string;
}

interface VisitResult {
  type: "visit";
  id: string;
  label: string;
  description: string;
  href: string;
}

type Result = NavResult | PatientResult | VisitResult;

const STATIC_PAGES: NavResult[] = [
  { type: "nav", id: "nav-patients",     label: "Patients",           description: "View all patients",            href: "/dashboard/patients",              icon: "👥" },
  { type: "nav", id: "nav-new-patient",  label: "New Patient",        description: "Register a new patient",       href: "/dashboard/patients/new",          icon: "➕" },
  { type: "nav", id: "nav-visits",       label: "Visits",             description: "View all visits",              href: "/dashboard/visits",                icon: "📋" },
  { type: "nav", id: "nav-appointments", label: "Appointments",       description: "Calendar & booking",           href: "/dashboard/appointments/calendar", icon: "📅" },
  { type: "nav", id: "nav-treatments",   label: "Treatment Plans",    description: "View all treatment plans",     href: "/dashboard/treatments",            icon: "🦷" },
  { type: "nav", id: "nav-recalls",      label: "Recalls",            description: "View recall list",             href: "/dashboard/recalls",               icon: "🔔" },
  { type: "nav", id: "nav-billing",      label: "Billing",            description: "Visit billing queue",          href: "/dashboard/billing",               icon: "💰" },
  { type: "nav", id: "nav-reports",      label: "Reports",            description: "Analytics & reports",          href: "/dashboard/reports",               icon: "📊" },
  { type: "nav", id: "nav-settings",     label: "Settings",           description: "Org settings",                 href: "/dashboard/settings",             icon: "⚙️" },
];

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);

  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<Result[]>(STATIC_PAGES);
  const [loading, setLoading]   = useState(false);
  const [cursor, setCursor]     = useState(0);

  const debouncedQuery = useDebounce(query, 200);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(STATIC_PAGES);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(STATIC_PAGES); return; }
    setLoading(true);
    try {
      const [patientRes, visitRes] = await Promise.allSettled([
        patientsApi.list({ search: q, limit: 6 }),
        visitsApi.list({ search: q, limit: 4 }),
      ]);

      const patients: PatientResult[] =
        patientRes.status === "fulfilled"
          ? (patientRes.value.patients ?? []).map((p: Patient) => ({
              type: "patient" as const,
              id: p.id,
              label: p.name,
              description: p.phone ?? p.email ?? "Patient",
              href: `/dashboard/patients/${p.id}`,
            }))
          : [];

      const visits: VisitResult[] =
        visitRes.status === "fulfilled"
          ? (visitRes.value.visits ?? []).map((v: { id: string; visitCode: string; patientName?: string | null }) => ({
              type: "visit" as const,
              id: v.id,
              label: v.visitCode,
              description: v.patientName ?? "Visit",
              href: `/dashboard/visits/${v.id}`,
            }))
          : [];

      const staticFiltered = STATIC_PAGES.filter(
        (p) =>
          p.label.toLowerCase().includes(q.toLowerCase()) ||
          p.description.toLowerCase().includes(q.toLowerCase())
      );

      setResults([...staticFiltered, ...patients, ...visits]);
      setCursor(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  function navigate(result: Result) {
    close();
    router.push(result.href);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      if (results[cursor]) navigate(results[cursor]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-black/45" onClick={close} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-pk-surface rounded-pk-lg shadow-pk-e3 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-pk-border">
          <svg className="w-4 h-4 text-pk-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search patients, visits, pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 bg-transparent text-sm text-pk-text placeholder:text-pk-text-muted outline-none"
          />
          {loading && (
            <span className="text-xs text-pk-text-muted animate-pulse">Searching…</span>
          )}
          <kbd className="hidden sm:inline-block text-xs text-pk-text-muted border border-pk-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <ul
          ref={listRef}
          className="max-h-80 overflow-y-auto py-2"
          role="listbox"
        >
          {results.length === 0 && (
            <li className="px-4 py-8 text-sm text-pk-text-muted text-center">No results found</li>
          )}
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === cursor}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                i === cursor ? "bg-pk-teal-50 text-pk-teal-800" : "text-pk-text hover:bg-pk-surface-raised"
              }`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => navigate(r)}
            >
              <span className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-pk-sm text-sm bg-pk-surface-sunken">
                {r.type === "patient" ? "👤"
                  : r.type === "visit" ? "📋"
                  : (r as NavResult).icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.label}</p>
                <p className="text-xs text-pk-text-muted truncate">{r.description}</p>
              </div>
              <span className="ml-auto text-xs text-pk-text-muted flex-shrink-0 capitalize">{r.type}</span>
            </li>
          ))}
        </ul>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-pk-border flex items-center gap-4 text-xs text-pk-text-muted">
          <span><kbd className="border border-pk-border rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="border border-pk-border rounded px-1">↵</kbd> open</span>
          <span><kbd className="border border-pk-border rounded px-1">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
