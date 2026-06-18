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

export interface DoctorStats {
  doctorId: string;
  doctorName: string;
  visits: number;
  billed: number;
  collected: number;
}

export interface ReportSummary {
  totalPatients: number;
  periodVisits: number;
  totalBilled: number;
  totalCollected: number;
  collectionRate: number;    // 0–100
  outstanding: number;
}

export interface AgingBucket {
  label: string;   // "0–30 days", "31–60 days", etc.
  count: number;
  amount: number;
}

export interface PatientFunnel {
  registered: number;
  hadVisit: number;
  hadTreatmentPlan: number;
  hadInvoice: number;
  hadPayment: number;
}

export interface TopOutstandingPatient {
  patientId: string;
  patientName: string;
  balance: number;
  openVisits: number;
}

export interface ReportData {
  period: {
    days: number;
    startMs: number;
    endMs: number;
    label: string;
  };
  summary: ReportSummary;
  prevSummary?: ReportSummary;  // same period shifted back — for period-over-period
  revenueByDay: DayRevenue[];
  newPatients: DayCount[];
  visitsByStatus: Record<string, number>;
  apptByStatus: Record<string, number>;
  topProcedures: TopProcedure[];
  treatmentByStatus: Record<string, number>;
  doctorBreakdown: DoctorStats[];
  agingBuckets: AgingBucket[];
  patientFunnel: PatientFunnel;
  topOutstandingPatients: TopOutstandingPatient[];
}
