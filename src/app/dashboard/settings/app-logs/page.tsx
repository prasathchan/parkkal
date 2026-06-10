"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { adminApi } from "@/api";
import type { AppLogEntry } from "@/api/admin";

// ─── Styling maps ──────────────────────────────────────────────────────────────

const LEVEL_PILL: Record<string, string> = {
  error:    "bg-red-100 text-red-700 border border-red-200",
  security: "bg-orange-100 text-orange-700 border border-orange-200",
  warn:     "bg-yellow-100 text-yellow-700 border border-yellow-200",
};
const LEVEL_ROW: Record<string, string> = {
  error:    "bg-red-50/30",
  security: "bg-orange-50/20",
  warn:     "bg-yellow-50/20",
};
const LEVEL_LABELS: Record<string, string> = {
  error: "Error", security: "Security", warn: "Warning",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ms: number) {
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function toDateInputValue(ms: number) {
  return new Date(ms).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AppLogsPage() {
  const [logs, setLogs]             = useState<AppLogEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [offset, setOffset]         = useState(0);
  const [forbidden, setForbidden]   = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [level,  setLevel]  = useState("");
  const [route,  setRoute]  = useState("");
  const [search, setSearch] = useState("");
  const [since,  setSince]  = useState("");
  const [until,  setUntil]  = useState("");
  const [sort,   setSort]   = useState<"desc" | "asc">("desc");

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (pageOffset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    let data;
    try {
      data = await adminApi.appLogs.list({
        level:  level  || undefined,
        route:  route  || undefined,
        search: search || undefined,
        since:  since  ? new Date(since).getTime()  : undefined,
        until:  until  ? new Date(until).getTime()  : undefined,
        sort,
        offset: pageOffset,
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403) { setForbidden(true); setLoading(false); return; }
      if (append) setLoadingMore(false);
      else        setLoading(false);
      return;
    }
    const rows: AppLogEntry[] = data.logs ?? [];

    if (append) setLogs((prev) => [...prev, ...rows]);
    else        setLogs(rows);

    setHasMore(data.hasMore ?? false);
    setOffset(pageOffset + rows.length);
    if (append) setLoadingMore(false);
    else        setLoading(false);
  }, [level, route, search, since, until, sort]);

  // Initial load + filter changes
  useEffect(() => {
    setOffset(0);
    fetchLogs(0, false);
  }, [fetchLogs]);

  // Auto-refresh every 15 s when enabled
  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(() => { setOffset(0); fetchLogs(0, false); }, 15_000);
    } else {
      if (refreshRef.current) clearInterval(refreshRef.current);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [autoRefresh, fetchLogs]);

  // ── Reset helpers ────────────────────────────────────────────────────────────
  function clearFilters() {
    setLevel(""); setRoute(""); setSearch(""); setSince(""); setUntil("");
  }
  function setLastHour() {
    setSince(toDateInputValue(Date.now() - 60 * 60_000));
    setUntil("");
  }
  function setLastDay() {
    setSince(toDateInputValue(Date.now() - 24 * 60 * 60_000));
    setUntil("");
  }

  const hasFilters = !!(level || route || search || since || until);

  // ── Forbidden guard ──────────────────────────────────────────────────────────
  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="App Logs" />
        <main className="max-w-6xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-500 text-sm">Only administrators can view application logs.</p>
          <Link href="/dashboard/settings" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
            Back to Settings
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="App Logs" />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-5">

        {/* Breadcrumb */}
        <nav className="text-sm text-slate-500 flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-slate-700">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/settings" className="hover:text-slate-700">Settings</Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">App Logs</span>
        </nav>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Application Logs</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Errors, security events, and warnings captured by the API layer.
              Info/debug logs are available via <code className="bg-slate-100 px-1 rounded">wrangler tail</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setOffset(0); fetchLogs(0, false); }}
              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition"
            >
              ↺ Refresh
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto (15 s)
            </label>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Level */}
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All levels</option>
              <option value="error">Error</option>
              <option value="security">Security</option>
              <option value="warn">Warning</option>
            </select>

            {/* Route substring */}
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="Filter by route…"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />

            {/* Message search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search message…"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "desc" | "asc")}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>

            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-700 underline">
                Clear
              </button>
            )}
          </div>

          {/* Date range row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Date range:</span>
            <input
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={setLastHour} className="text-xs text-blue-600 hover:text-blue-800 underline">Last hour</button>
            <button onClick={setLastDay}  className="text-xs text-blue-600 hover:text-blue-800 underline">Last 24 h</button>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="font-medium">Level:</span>
          {Object.entries(LEVEL_PILL).map(([l, cls]) => (
            <span key={l} className={`px-2 py-0.5 rounded-full ${cls}`}>{LEVEL_LABELS[l]}</span>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading logs…</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No log entries found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-44">When</th>
                  <th className="px-4 py-3 text-left font-medium w-24">Level</th>
                  <th className="px-4 py-3 text-left font-medium w-56">Route</th>
                  <th className="px-4 py-3 text-left font-medium">Message</th>
                  <th className="px-4 py-3 text-left font-medium w-28">User</th>
                  <th className="px-4 py-3 text-left font-medium w-16">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  const hasDetail  = !!(entry.data || entry.errorStack);

                  return (
                    <>
                      <tr
                        key={entry.id}
                        className={`hover:bg-slate-50 transition ${hasDetail ? "cursor-pointer" : ""} ${LEVEL_ROW[entry.level] ?? ""}`}
                        onClick={() => hasDetail && setExpandedId(isExpanded ? null : entry.id)}
                      >
                        {/* When */}
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {fmt(entry.createdAt)}
                        </td>

                        {/* Level */}
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LEVEL_PILL[entry.level] ?? ""}`}>
                            {LEVEL_LABELS[entry.level] ?? entry.level}
                          </span>
                        </td>

                        {/* Route */}
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 truncate max-w-[14rem]" title={entry.route ?? undefined}>
                          {entry.route}
                        </td>

                        {/* Message */}
                        <td className="px-4 py-3 text-slate-800 text-xs">
                          <div className="truncate max-w-xs" title={entry.message}>{entry.message}</div>
                          {entry.errorName && (
                            <div className="text-slate-400 mt-0.5">{entry.errorName}</div>
                          )}
                        </td>

                        {/* User */}
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {entry.userId
                            ? <>{entry.userId.slice(0, 8)}… <span className="text-slate-400">({entry.userRole})</span></>
                            : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Expand toggle */}
                        <td className="px-4 py-3 text-center text-xs">
                          {hasDetail
                            ? <span className="text-blue-500">{isExpanded ? "▲" : "▼"}</span>
                            : <span className="text-slate-200">—</span>}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${entry.id}-detail`} className="bg-slate-50">
                          <td colSpan={6} className="px-4 py-3 space-y-3">
                            {entry.errorStack && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Stack trace</p>
                                <pre className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3 overflow-x-auto whitespace-pre-wrap">
                                  {entry.errorStack}
                                </pre>
                              </div>
                            )}
                            {entry.data && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Context</p>
                                <pre className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-4 py-3 overflow-x-auto">
                                  {JSON.stringify(entry.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Load more */}
          {!loading && hasMore && (
            <div className="px-4 py-4 border-t border-slate-100 text-center">
              <button
                onClick={() => fetchLogs(offset, true)}
                disabled={loadingMore}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
