import { apiFetch } from "./_client";
import type { BackupListResponse } from "@/types/backup";

export const backupApi = {
  list(): Promise<BackupListResponse> {
    return apiFetch("/api/backup/snapshots");
  },

  snapshot(): Promise<{ id: string }> {
    return apiFetch("/api/backup/snapshot", { method: "POST" });
  },

  restore(snapshotId: string): Promise<{ restored: boolean }> {
    return apiFetch("/api/backup/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotId, confirmation: "RESTORE" }),
    });
  },
};
