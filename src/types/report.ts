/**
 * types/report.ts
 *
 * TypeScript shapes for the reports/analytics API response.
 */

export type ReportPeriod = "7d" | "30d" | "90d" | "365d";
// Re-exported so pages can import from either @/types or @/api/reports

export interface DayRevenue {
  date: string;      // "YYYY-MM-DD"
  billed: number;
  collected: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface TopProcedure {
  procedure: string;
  count: number;
  revenue: number;
}

export interface ReportSummary {
  totalPatients: number;
  periodVisits: number;
  totalBilled: number;
  totalCollected: number;
  collectionRate: number;    // 0–100
  outstanding: number;
}

export interface ReportData {
  period: {
    days: number;
    startMs: number;
    label: string;
  };
  summary: ReportSummary;
  revenueByDay: DayRevenue[];
  newPatients: DayCount[];
  visitsByStatus: Record<string, number>;
  apptByStatus: Record<string, number>;
  topProcedures: TopProcedure[];
  treatmentByStatus: Record<string, number>;
}
