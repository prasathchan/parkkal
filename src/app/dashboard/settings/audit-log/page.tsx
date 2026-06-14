"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { adminApi } from "@/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorRole: string;
  actorName: string | null;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

// ─── Action metadata ──────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info";

const ACTION_META: Record<string, { label: string; severity: Severity }> = {
  ORG_DELETED:                  { label: "Organisation Deleted",     severity: "critical" },
  PATIENT_DELETED:              { label: "Patient Deleted",          severity: "critical" },
  VISIT_DELETED:                { label: "Visit Deleted",            severity: "critical" },
  TREATMENT_DELETED:            { label: "Treatment Deleted",        severity: "critical" },
  SALARY_DELETED:               { label: "Salary Record Deleted",    severity: "critical" },
  MEMBER_DELETED:               { label: "Staff Member Removed",     severity: "critical" },
  MEMBER_DEACTIVATED:           { label: "Staff Deactivated",        severity: "warning"  },
  MEMBER_ROLE_CHANGED:          { label: "Role Changed",             severity: "warning"  },
  ROLE_DELETED:                 { label: "Custom Role Deleted",      severity: "warning"  },
  ROLE_UPDATED:                 { label: "Custom Role Updated",      severity: "warning"  },
  MEMBER_UPDATED:               { label: "Staff Profile Updated",    severity: "info"     },
  MEMBER_INVITED:               { label: "Staff Invited",            severity: "info"     },
  MEMBER_ACTIVATION_SENT:       { label: "Activation Link Sent",     severity: "info"     },
  MEMBER_PORTAL_ACCESS_CHANGED: { label: "Portal Access Changed",    severity: "info"     },
  ROLE_CREATED:                 { label: "Custom Role Created",      severity: "info"     },
  ORG_PROFILE_UPDATED:          { label: "Organisation Updated",     severity: "info"     },
  ORG_LOGO_DELETED:             { label: "Logo Deleted",             severity: "info"     },
  SALARY_GENERATED:             { label: "Salary Records Generated", severity: "info"     },
};

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-pk-danger-fill text-pk-danger-text border border-pk-danger-border",
  warning:  "bg-pk-warning-fill text-pk-warning-text border border-pk-warning-border",
  info:     "bg-pk-surface-sunken text-pk-text-secondary border border-pk-border",
};

const SEVERITY_ROW: Record<Severity, string> = {
  critical: "bg-pk-danger-fill",
  warning:  "bg-pk-warning-fill",
  info:     "",
};

const FILTER_OPTIONS = [
  { value: "",                          label: "All Actions" },
  { value: "ORG_DELETED",              label: "Org Deleted" },
  { value: "PATIENT_DELETED",          label: "Patient Deleted" },
  { value: "VISIT_DELETED",            label: "Visit Deleted" },
  { value: "TREATMENT_DELETED",        label: "Treatment Deleted" },
  { value: "MEMBER_DEACTIVATED",       label: "Staff Deactivated" },
  { value: "MEMBER_ROLE_CHANGED",      label: "Role Changed" },
  { value: "MEMBER_INVITED",           label: "Staff Invited" },
  { value: "SALARY_GENERATED",         label: "Salary Generated" },
  { value: "ORG_PROFILE_UPDATED",      label: "Org Updated" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function actorDisplay(entry: AuditEntry): string {
  const name = entry.actorName ?? entry.actorId.slice(0, 8);
  return `${name} (${entry.actorRole})`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchEntries = useCallback(async (pageOffset: number, append: boolean, filter: string) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    let data;
    try {
      data = await adminApi.auditLog.list({ action: filter || undefined, offset: pageOffset });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403) { setForbidden(true); setLoading(false); return; }
      if (append) setLoadingMore(false);
      else setLoading(false);
      return;
    }
    const rows: AuditEntry[] = data.entries ?? [];

    if (append) {
      setEntries((prev) => [...prev, ...rows]);
    } else {
      setEntries(rows);
    }
    setHasMore(data.hasMore ?? false);
    setOffset(pageOffset + rows.length);

    if (append) setLoadingMore(false);
    else setLoading(false);
  }, []);

  // Initial load + filter change
  useEffect(() => {
    setOffset(0);
    fetchEntries(0, false, actionFilter);
  }, [actionFilter, fetchEntries]);

  if (forbidden) {
    return (
      <div className="min-h-screen bg-pk-surface-raised">
        <Header title="Audit Log" />
        <main id="main-content" className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-pk-text-muted text-sm">Only administrators can view the audit log.</p>
          <Link href="/dashboard/settings" className="mt-4 inline-block text-pk-teal-600 hover:underline text-sm">
            Back to Settings
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pk-surface-raised">
      <Header title="Audit Log" />
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        {/* Breadcrumb */}
        <nav className="text-sm text-pk-text-muted flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-pk-text-secondary">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/settings" className="hover:text-pk-text-secondary">Settings</Link>
          <span>/</span>
          <span className="text-pk-text font-medium">Audit Log</span>
        </nav>

        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-pk-text">Audit Log</h1>
            <p className="text-xs text-pk-text-muted mt-0.5">
              All administrative actions performed in your organisation, newest first.
            </p>
          </div>
          {/* Action filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm border border-pk-border rounded-lg px-3 py-2 bg-white text-pk-text-secondary focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-pk-text-muted">
          <span className="font-medium">Severity:</span>
          <span className={`px-2 py-0.5 rounded-full ${SEVERITY_PILL.critical}`}>Critical (irreversible deletes)</span>
          <span className={`px-2 py-0.5 rounded-full ${SEVERITY_PILL.warning}`}>Warning (access/role changes)</span>
          <span className={`px-2 py-0.5 rounded-full ${SEVERITY_PILL.info}`}>Info</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-pk-border overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-pk-text-muted text-sm">Loading audit log…</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-pk-text-muted text-sm">No audit log entries found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-pk-surface-raised text-xs text-pk-text-muted uppercase tracking-wide border-b border-pk-border">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">When</th>
                  <th className="px-5 py-3 text-left font-medium">Action</th>
                  <th className="px-5 py-3 text-left font-medium">By</th>
                  <th className="px-5 py-3 text-left font-medium">Target</th>
                  <th className="px-5 py-3 text-left font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pk-border">
                {entries.map((entry) => {
                  const meta = ACTION_META[entry.action];
                  const severity: Severity = meta?.severity ?? "info";
                  const isExpanded = expandedId === entry.id;

                  return (
                    <>
                      <tr
                        key={entry.id}
                        className={`hover:bg-pk-surface-raised transition cursor-pointer ${SEVERITY_ROW[severity]}`}
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <td className="px-5 py-3 text-pk-text-muted whitespace-nowrap text-xs">
                          {formatTimestamp(entry.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEVERITY_PILL[severity]}`}>
                            {meta?.label ?? entry.action}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-pk-text-secondary text-xs">{actorDisplay(entry)}</td>
                        <td className="px-5 py-3 text-pk-text-muted text-xs">
                          {entry.targetType}
                          {entry.targetId && (
                            <span className="ml-1 font-mono text-pk-text-muted">{entry.targetId.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-pk-text-muted text-xs">
                          {entry.metadata
                            ? <span className="text-pk-teal-500 hover:text-pk-teal-700">{isExpanded ? "▲ hide" : "▼ show"}</span>
                            : <span>—</span>}
                        </td>
                      </tr>

                      {/* Expanded metadata row */}
                      {isExpanded && entry.metadata && (
                        <tr key={`${entry.id}-meta`} className="bg-pk-surface-raised">
                          <td colSpan={5} className="px-5 py-3">
                            <pre className="text-xs text-pk-text-secondary bg-white border border-pk-border rounded-lg px-4 py-3 overflow-x-auto">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
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
            <div className="px-5 py-4 border-t border-pk-border text-center">
              <button
                onClick={() => fetchEntries(offset, true, actionFilter)}
                disabled={loadingMore}
                className="text-sm text-pk-teal-600 hover:text-pk-teal-800 font-medium disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more entries"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
