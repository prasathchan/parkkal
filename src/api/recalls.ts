/**
 * api/recalls.ts
 *
 * API calls for the recalls dashboard.
 *
 * HOW TO USE:
 *   import { recallsApi } from "@/api";
 *
 *   const { recalls, total } = await recallsApi.list({ status: "overdue" });
 */

import { apiFetch } from "./_client";
import type { RecallVisit, RecallListResponse } from "@/types";

export interface ListRecallsParams {
  status?:     "unscheduled" | "scheduled" | "fulfilled" | "lapsed" | "all";
  locationId?: string;
  limit?:      number;
  offset?:     number;
}

export function listRecalls(
  params: ListRecallsParams = {},
): Promise<RecallListResponse> {
  const q = new URLSearchParams();
  if (params.status)     q.set("status",     params.status);
  if (params.locationId) q.set("locationId", params.locationId);
  if (params.limit  != null) q.set("limit",  String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<RecallListResponse>(`/api/recalls?${q}`);
}

export function notifyRecalls(
  visitIds: string[],
): Promise<{ sent: number; skipped: number; failed: number }> {
  return apiFetch<{ sent: number; skipped: number; failed: number }>("/api/recalls/notify", {
    method: "POST",
    body: JSON.stringify({ visitIds }),
  });
}

export const recallsApi = {
  list: listRecalls,
  notify: notifyRecalls,
};

export type { RecallVisit };
