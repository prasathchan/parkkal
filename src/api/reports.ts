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
  from?: string;       // YYYY-MM-DD
  to?: string;         // YYYY-MM-DD
  locationId?: string; // optional branch filter
}

export function getReport(params: ReportParams | ReportPeriod): Promise<ReportData> {
  if (typeof params === "string") {
    return apiFetch<ReportData>(`/api/reports?period=${params}`);
  }
  const { period, from, to, locationId } = params;
  const qs = new URLSearchParams();
  if (period && period !== "custom") qs.set("period", period);
  if (from)       qs.set("from",       from);
  if (to)         qs.set("to",         to);
  if (locationId) qs.set("locationId", locationId);
  return apiFetch<ReportData>(`/api/reports?${qs}`);
}

export interface BranchStat {
  locationId:     string;
  locationName:   string;
  visits:         number;
  appointments:   number;
  billed:         number;
  collected:      number;
  collectionRate: number;
}

export function getBranchComparison(params: Omit<ReportParams, "locationId">): Promise<{ branches: BranchStat[]; period: { start: number; end: number } }> {
  const qs = new URLSearchParams();
  if (params.period && params.period !== "custom") qs.set("period", params.period);
  if (params.from) qs.set("from", params.from);
  if (params.to)   qs.set("to",   params.to);
  return apiFetch(`/api/reports/branch-comparison?${qs}`);
}

export const reportsApi = {
  get:              getReport,
  branchComparison: getBranchComparison,
};
