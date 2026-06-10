/**
 * types/report.ts
 *
 * TypeScript shapes for the reports/analytics API response.
 */

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
