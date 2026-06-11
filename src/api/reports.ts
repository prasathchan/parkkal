/**
 * api/reports.ts
 *
 * API calls for the reports/analytics dashboard.
 *
 * HOW TO USE:
 *   import { reportsApi } from "@/api";
 *
 *   const data = await reportsApi.get("30d");
 */

import { apiFetch } from "./_client";
import type { ReportData } from "@/types";

export type ReportPeriod = "7d" | "30d" | "90d" | "365d" | "custom";

export interface ReportParams {
  period?: ReportPeriod;
  from?: string;  // YYYY-MM-DD
  to?: string;    // YYYY-MM-DD
}

export function getReport(params: ReportParams | ReportPeriod): Promise<ReportData> {
  if (typeof params === "string") {
    return apiFetch<ReportData>(`/api/reports?period=${params}`);
  }
  const { period, from, to } = params;
  const qs = new URLSearchParams();
  if (period && period !== "custom") qs.set("period", period);
  if (from) qs.set("from", from);
  if (to)   qs.set("to",   to);
  return apiFetch<ReportData>(`/api/reports?${qs}`);
}

export const reportsApi = {
  get: getReport,
};
