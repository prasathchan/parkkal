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
  status?: "unscheduled" | "scheduled" | "fulfilled" | "lapsed" | "all";
  limit?: number;
  offset?: number;
}

export function listRecalls(
  params: ListRecallsParams = {},
): Promise<RecallListResponse> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.limit  != null) q.set("limit",  String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<RecallListResponse>(`/api/recalls?${q}`);
}

export const recallsApi = {
  list: listRecalls,
};

export type { RecallVisit };
