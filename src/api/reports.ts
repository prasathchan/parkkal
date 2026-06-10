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

export type ReportPeriod = "7d" | "30d" | "90d";

export function getReport(period: ReportPeriod): Promise<ReportData> {
  return apiFetch<ReportData>(`/api/reports?period=${period}`);
}

export const reportsApi = {
  get: getReport,
};
