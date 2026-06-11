export interface OrgBackup {
  id:           string;
  type:         "auto" | "manual";
  status:       "pending" | "completed" | "failed";
  sizeBytes:    number | null;
  rowCounts:    string | null; // JSON string
  createdBy:    string | null;
  createdAt:    number;
  errorMessage: string | null;
}

export interface BackupListResponse {
  snapshots: OrgBackup[];
}
