"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/header";
import { useAsync } from "@/hooks/use-async";
import { backupApi, ApiError } from "@/api";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import type { OrgBackup } from "@/types";

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRowCounts(json: string | null): string {
  if (!json) return "";
  try {
    const counts = JSON.parse(json) as Record<string, number>;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const pts = counts.patients ?? 0;
    const vis = counts.visits ?? 0;
    return `${total.toLocaleString()} rows · ${pts} patients · ${vis} visits`;
  } catch {
    return "";
  }
}

function StatusBadge({ status }: { status: OrgBackup["status"] }) {
  if (status === "completed")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>;
  if (status === "pending")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pending…</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Failed</span>;
}

function TypeBadge({ type }: { type: OrgBackup["type"] }) {
  if (type === "auto")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pk-surface-sunken text-pk-text-secondary">Auto</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pk-teal-100 text-pk-teal-700">Manual</span>;
}

// ── Restore confirmation modal ─────────────────────────────────────────────────

function RestoreModal({
  snapshot,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  snapshot: OrgBackup;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}) {
  const [input, setInput] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-pk-text">Restore from snapshot</p>
            <p className="text-sm text-pk-text-muted">{new Date(snapshot.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
          This will <strong>permanently overwrite</strong> all current patient, visit, treatment, billing, and appointment data with the snapshot. This cannot be undone.
        </div>

        {snapshot.rowCounts && (
          <p className="text-xs text-pk-text-muted mb-4">{formatRowCounts(snapshot.rowCounts)}</p>
        )}

        <label className="block text-sm font-medium text-pk-text-secondary mb-1">
          Type <span className="font-mono bg-pk-surface-sunken px-1 rounded">RESTORE</span> to confirm
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="RESTORE"
          className="w-full border border-pk-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
          autoFocus
        />

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-pk-border-strong text-pk-text-secondary hover:bg-pk-surface-raised disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={input !== "RESTORE" || loading}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Restoring…" : "Restore"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BackupPage() {
  const { data, loading, error, refetch } = useAsync(() => backupApi.list(), []);

  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");

  const [restoreTarget, setRestoreTarget] = useState<OrgBackup | null>(null);
  const [restoring, setRestoring]         = useState(false);
  const [restoreError, setRestoreError]   = useState("");
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const handleSnapshot = useCallback(async () => {
    setSnapshotting(true);
    setSnapshotError("");
    try {
      await backupApi.snapshot();
      refetch();
    } catch (e) {
      setSnapshotError(e instanceof ApiError ? e.message : "Snapshot failed. Please try again.");
    } finally {
      setSnapshotting(false);
    }
  }, [refetch]);

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setRestoreError("");
    try {
      await backupApi.restore(restoreTarget.id);
      setRestoreSuccess(true);
      setRestoreTarget(null);
      refetch();
    } catch (e) {
      setRestoreError(e instanceof ApiError ? e.message : "Restore failed. Please try again.");
    } finally {
      setRestoring(false);
    }
  }, [restoreTarget, refetch]);

  const snapshots: OrgBackup[] = data?.snapshots ?? [];

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Backup & Restore"
        breadcrumb={[{ label: "Dashboard" }, { label: "Settings" }, { label: "Backup" }]}
      />

      <main id="main-content" className="flex-1 p-6 max-w-3xl space-y-6">

        {/* Info card */}
        <div className="bg-pk-teal-50 border border-pk-teal-200 rounded-xl p-4 text-sm text-pk-teal-800">
          <p className="font-medium mb-1">How it works</p>
          <ul className="space-y-0.5 text-pk-teal-700 list-disc list-inside">
            <li>A snapshot is taken automatically every night at 2 AM.</li>
            <li>Snapshots keep 30 daily + 1 per month for 12 months.</li>
            <li>Restoring replaces all current data with the selected snapshot.</li>
          </ul>
        </div>

        {/* Take snapshot button */}
        <div className="bg-white rounded-xl border border-pk-border shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-pk-text">Take a snapshot now</p>
              <p className="text-sm text-pk-text-muted mt-0.5">Creates a manual backup of all current data.</p>
            </div>
            <button
              type="button"
              onClick={handleSnapshot}
              disabled={snapshotting}
              className="inline-flex items-center gap-2 bg-pk-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition"
            >
              {snapshotting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Taking snapshot…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Take Snapshot
                </>
              )}
            </button>
          </div>
          {snapshotError && (
            <p className="mt-3 text-sm text-red-600">{snapshotError}</p>
          )}
        </div>

        {restoreSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Restore completed</p>
              <p className="mt-0.5">All data has been replaced with the selected snapshot. Reload the page to see the restored data.</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-green-700 text-white text-xs font-medium hover:bg-green-800 transition"
            >
              Reload now
            </button>
          </div>
        )}

        {/* Snapshot timeline */}
        <div className="bg-white rounded-xl border border-pk-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-pk-border flex items-center justify-between">
            <p className="font-medium text-pk-text">Snapshot history</p>
            <p className="text-xs text-pk-text-muted">{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}</p>
          </div>

          {error && <ErrorState message="Failed to load snapshots." onRetry={refetch} />}

          {!error && !loading && snapshots.length === 0 && (
            <EmptyState
              title="No snapshots yet"
              description="Take a manual snapshot or wait for the nightly auto-backup."
            />
          )}

          {!error && (loading || snapshots.length > 0) && (
            <div className="divide-y divide-pk-border">
              {loading && (
                <div className="px-5 py-4 text-sm text-pk-text-muted">Loading snapshots…</div>
              )}
              {snapshots.map((snap) => (
                <div key={snap.id} className="px-5 py-4 flex items-center gap-4 hover:bg-pk-surface-raised transition">
                  {/* Timeline dot */}
                  <div className="w-2 h-2 rounded-full bg-pk-neutral-300 flex-shrink-0 mt-0.5" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-pk-text">
                        {new Date(snap.createdAt).toLocaleString()}
                      </span>
                      <TypeBadge type={snap.type} />
                      <StatusBadge status={snap.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-pk-text-muted flex-wrap">
                      {snap.rowCounts && <span>{formatRowCounts(snap.rowCounts)}</span>}
                      <span>{formatBytes(snap.sizeBytes)}</span>
                    </div>
                    {snap.status === "failed" && snap.errorMessage && (
                      <p className="text-xs text-red-600 mt-0.5">{snap.errorMessage}</p>
                    )}
                  </div>

                  {snap.status === "completed" && (
                    <button
                      type="button"
                      onClick={() => { setRestoreTarget(snap); setRestoreError(""); setRestoreSuccess(false); }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium flex-shrink-0 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition"
                    >
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-pk-text-muted">
          Snapshots are stored in Cloudflare R2 (<span className="font-mono">parkkal-backups</span>).
          Retention: 30 daily + 12 monthly. Contact support to download a raw copy.
        </p>
      </main>

      {restoreTarget && (
        <RestoreModal
          snapshot={restoreTarget}
          onConfirm={handleRestore}
          onCancel={() => { setRestoreTarget(null); setRestoreError(""); }}
          loading={restoring}
          error={restoreError}
        />
      )}
    </div>
  );
}
