"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSidebar } from "@/context/sidebar-context";
import { useCommandPalette } from "@/context/command-palette-context";
import { useLocation } from "@/context/location-context";

interface HeaderProps {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
  user?: { name: string; role: string };
}

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Open command palette" },
  { keys: ["K"],       label: "Open command palette" },
  { keys: ["Esc"],     label: "Close modal / palette" },
  { keys: ["N"],       label: "New patient (on patients page)" },
  { keys: ["/"],       label: "Focus search (on list pages)" },
];

const HELP_ARTICLES = [
  {
    q: "How do I record a payment?",
    a: "Open the visit, go to the Items tab, and use the Quick-Pay row at the bottom to record cash, UPI, or card payments instantly. For more options (advance payments, treatment-linked payments), switch to the Payments tab.",
  },
  {
    q: "What is Emergency Override?",
    a: "Emergency Override lets a doctor proceed with treatment when a signed consent form has not yet been uploaded. It requires a written reason and is logged in the audit trail. All admin users receive an email notification when it is applied.",
  },
  {
    q: "How do I link a treatment plan to a visit bill?",
    a: "In the Treatment Plan tab of a visit, click the link icon (⛓) next to the treatment. Choose 'Link Only' to associate it with the visit, or 'Link & Add to Bill' to add the treatment cost directly as a line item on the invoice.",
  },
  {
    q: "How do I book a recall appointment?",
    a: "Go to Recalls in the sidebar. Find the patient with 'Not Booked' status and click 'Book Now'. This pre-fills the new appointment form with the patient details and recall context. Once the appointment is completed, the recall status updates automatically.",
  },
  {
    q: "How do I import patients from a spreadsheet?",
    a: "Go to Patients → Import CSV. Download the template, fill in your patient data (name and phone are required), then upload and review the preview. Invalid rows are highlighted before you confirm the import. Up to 1,000 patients per batch.",
  },
  {
    q: "How do I mark multiple appointments as completed?",
    a: "Go to Appointments → List View. Use the checkboxes to select appointments, then use the 'Mark Completed' or 'Mark No-Show' buttons that appear in the action bar. Maximum 50 appointments per bulk action.",
  },
  {
    q: "How do I see outstanding balances?",
    a: "The Reports page (Admin / Manager only) shows the Outstanding Balance Aging table, which groups unpaid visits by how long they've been open. The Insights section also lists the top 5 patients by outstanding balance.",
  },
  {
    q: "How do I add staff and set their permissions?",
    a: "Go to Settings → Staff to invite a new team member. Assign them a role (Admin, Doctor, Receptionist, Nurse, etc.) or create a custom role under Settings → Roles where you can pick individual permissions.",
  },
  {
    q: "What does the tooth chart FDI numbering mean?",
    a: "Parkkal uses FDI (Fédération Dentaire Internationale) two-digit tooth numbering. The first digit is the quadrant (1=upper right, 2=upper left, 3=lower left, 4=lower right) and the second is the tooth position (1=central incisor … 8=wisdom tooth). Example: 36 = lower-left first molar.",
  },
  {
    q: "How do I print a receipt?",
    a: "Open the visit and go to the Payments tab. If at least one payment has been recorded, a 'Print Receipt' button appears. Click it to open a printable receipt in a new tab — it includes the clinic header, patient details, itemised bill, and payment history.",
  },
];

function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Read current state from DOM (ThemeProvider already applied org default)
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pk-dark-mode", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 flex items-center justify-center rounded-pk-sm text-pk-text-muted hover:bg-pk-surface-sunken transition"
    >
      {isDark ? (
        // Sun icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        // Moon icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function HelpPanel() {
  const [open, setOpen]     = useState(false);
  const [tab, setTab]       = useState<"help" | "shortcuts">("help");
  const [query, setQuery]   = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const filteredArticles = query.trim()
    ? HELP_ARTICLES.filter((a) =>
        a.q.toLowerCase().includes(query.toLowerCase()) ||
        a.a.toLowerCase().includes(query.toLowerCase())
      )
    : HELP_ARTICLES;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Help"
        title="Help"
        className="w-8 h-8 flex items-center justify-center rounded-pk-sm text-pk-text-muted hover:bg-pk-surface-sunken transition text-sm font-semibold border border-pk-border"
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[92vw] bg-pk-surface border border-pk-border rounded-pk-lg shadow-pk-e3 z-50 overflow-hidden flex flex-col" style={{ maxHeight: "80vh" }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-pk-border flex items-center justify-between">
            <p className="text-sm font-semibold text-pk-text">Help &amp; Shortcuts</p>
            <button onClick={() => setOpen(false)} className="text-pk-text-muted hover:text-pk-text transition text-lg leading-none">×</button>
          </div>
          {/* Tabs */}
          <div className="flex border-b border-pk-border">
            {(["help", "shortcuts"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium transition ${tab === t ? "border-b-2 border-pk-teal-600 text-pk-teal-700" : "text-pk-text-secondary hover:text-pk-text"}`}
              >
                {t === "help" ? "Common Tasks" : "Keyboard Shortcuts"}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {tab === "help" ? (
              <div className="p-3 space-y-1">
                <input
                  type="search"
                  placeholder="Search help…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-pk-border rounded-pk-sm bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500 mb-2"
                />
                {filteredArticles.length === 0 ? (
                  <p className="text-xs text-pk-text-muted text-center py-4">No results for &ldquo;{query}&rdquo;</p>
                ) : (
                  filteredArticles.map((article, i) => (
                    <details key={i} className="group rounded-pk-sm border border-pk-border overflow-hidden">
                      <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm font-medium text-pk-text hover:bg-pk-surface-raised select-none list-none">
                        <span>{article.q}</span>
                        <svg className="w-4 h-4 text-pk-text-muted shrink-0 ml-2 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-3 pb-3 pt-1 text-sm text-pk-text-secondary border-t border-pk-border bg-pk-surface-raised">
                        {article.a}
                      </div>
                    </details>
                  ))
                )}
              </div>
            ) : (
              <ul className="py-2">
                {SHORTCUTS.map((s, i) => (
                  <li key={i} className="flex items-center justify-between px-4 py-2">
                    <span className="text-sm text-pk-text-secondary">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd key={k} className="text-xs font-mono bg-pk-surface-sunken border border-pk-border rounded px-1.5 py-0.5 text-pk-text">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Footer */}
          <div className="px-4 py-2 border-t border-pk-border text-xs text-pk-text-muted">
            API docs at <a href="/api/docs" target="_blank" rel="noreferrer" className="text-pk-teal-600 hover:underline">/api/docs</a>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationSelector() {
  const {
    locations, selectedLocationId, setSelectedLocationId,
    selectedLocation, isMultiBranch, canSwitchLocation, loading,
  } = useLocation();
  if (loading || !isMultiBranch) return null;

  const icon = (
    <svg className="w-3.5 h-3.5 text-pk-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  // Locked: non-admin/manager with a primary location — show a read-only badge
  if (!canSwitchLocation) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-pk-sm bg-pk-surface-raised border border-pk-border">
        {icon}
        <span className="text-xs font-medium text-pk-text truncate max-w-[120px]">
          {selectedLocation?.name ?? "My Branch"}
        </span>
        <svg className="w-3 h-3 text-pk-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center gap-1.5">
      {icon}
      <select
        value={selectedLocationId ?? ""}
        onChange={(e) => setSelectedLocationId(e.target.value || null)}
        className="text-sm border border-pk-border rounded-pk-sm px-2 py-1 bg-pk-surface text-pk-text focus:outline-none focus:ring-2 focus:ring-pk-teal-500 max-w-[160px]"
        aria-label="Select branch"
      >
        <option value="">All Locations</option>
        {locations
          .filter((l) => l.isActive)
          .map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
      </select>
    </div>
  );
}

export function Header({ title, breadcrumb, user }: HeaderProps) {
  const { toggle } = useSidebar();
  const { open: openPalette } = useCommandPalette();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-pk-surface focus:border focus:border-pk-teal-500 focus:px-4 focus:py-2 focus:rounded-pk-sm focus:text-sm focus:font-medium focus:text-pk-teal-700 focus:shadow-pk-e2"
      >
        Skip to main content
      </a>
      <header className="bg-pk-surface border-b border-pk-border px-4 sm:px-6 py-3.5 flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger — only visible on mobile */}
          <button
            type="button"
            onClick={toggle}
            className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-pk-sm text-pk-text-muted hover:bg-pk-surface-sunken transition"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-pk-text truncate">{title}</h1>
            {breadcrumb && breadcrumb.length > 0 && (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 mt-0.5 flex-wrap">
                {breadcrumb.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-pk-text-muted text-xs" aria-hidden="true">/</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} className="text-xs text-pk-teal-600 hover:text-pk-teal-800 hover:underline transition-colors">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-xs text-pk-text-muted" aria-current={i === breadcrumb.length - 1 ? "page" : undefined}>
                        {crumb.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <LocationSelector />
          {/* Search / command palette trigger */}
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search (⌘K)"
            title="Search (⌘K)"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-pk-sm text-sm text-pk-text-muted border border-pk-border hover:bg-pk-surface-sunken transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden lg:inline">Search…</span>
            <kbd className="hidden lg:inline text-xs font-mono bg-pk-surface-sunken border border-pk-border rounded px-1 py-0.5">⌘K</kbd>
          </button>
          {/* Mobile search icon */}
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search"
            className="sm:hidden w-8 h-8 flex items-center justify-center rounded-pk-sm text-pk-text-muted hover:bg-pk-surface-sunken transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <DarkModeToggle />
          <HelpPanel />

          {user && (
            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-pk-border">
              <div className="w-7 h-7 bg-pk-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-pk-text leading-tight">{user.name}</p>
                <p className="text-xs text-pk-text-muted leading-tight">{user.role}</p>
              </div>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
