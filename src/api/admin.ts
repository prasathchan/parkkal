/**
 * api/admin.ts
 *
 * Admin-only API calls (audit log, system ops).
 * These endpoints require ADMIN role.
 */

import { apiFetch } from "./_client";

export interface AuditEntry {
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

export interface ListAuditLogParams {
  action?: string;
  offset?: number;
  limit?: number;
}

export function listAuditLog(
  params: ListAuditLogParams = {},
): Promise<{ entries: AuditEntry[]; hasMore: boolean }> {
  const q = new URLSearchParams();
  if (params.action) q.set("action", params.action);
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.limit != null) q.set("limit", String(params.limit));
  return apiFetch<{ entries: AuditEntry[]; hasMore: boolean }>(`/api/admin/audit-log?${q}`);
}

export interface AppLogEntry {
  id: string;
  level: string;
  message: string;
  route?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  createdAt: number;
  [key: string]: unknown;
}

export interface ListAppLogsParams {
  level?: string;
  route?: string;
  search?: string;
  since?: string | number;
  until?: string | number;
  sort?: string;
  offset?: number;
  limit?: number;
}

export function listAppLogs(
  params: ListAppLogsParams = {},
): Promise<{ logs: AppLogEntry[]; hasMore: boolean }> {
  const q = new URLSearchParams();
  if (params.level)  q.set("level",  params.level);
  if (params.route)  q.set("route",  params.route);
  if (params.search) q.set("search", params.search);
  if (params.since != null)  q.set("since",  String(params.since));
  if (params.until != null)  q.set("until",  String(params.until));
  if (params.sort)   q.set("sort",   params.sort);
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.limit  != null) q.set("limit",  String(params.limit));
  return apiFetch<{ logs: AppLogEntry[]; hasMore: boolean }>(`/api/admin/app-logs?${q}`);
}

export const adminApi = {
  auditLog: {
    list: listAuditLog,
  },
  appLogs: {
    list: listAppLogs,
  },
};
