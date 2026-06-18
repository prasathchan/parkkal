// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/api", () => ({
  reportsApi: { get: vi.fn(), branchComparison: vi.fn().mockResolvedValue({ branches: [], period: { start: 0, end: 0 } }) },
  locationsApi: { list: vi.fn().mockResolvedValue({ locations: [] }) },
  authApi: { me: vi.fn().mockResolvedValue({ user: { role: "ADMIN", primaryLocationId: null } }) },
  ApiError: class ApiError extends Error {},
}));

import ReportsPage from "../reports/page";
import { reportsApi } from "@/api";

const mockGet = reportsApi.get as ReturnType<typeof vi.fn>;

const REPORT_DATA = {
  period: { label: "This Month", value: "month", start: "2026-06-01", end: "2026-06-30" },
  summary: {
    totalPatients: 120, periodVisits: 45, totalBilled: 150000,
    totalCollected: 130000, collectionRate: 87, newPatients: 12,
    avgVisitValue: 3333, outstanding: 20000,
  },
  prevSummary: null,
  revenueByDay: [],
  newPatients: [],
  visitsByStatus: {},
  apptByStatus: {},
  treatmentByStatus: {},
  topProcedures: [],
  agingBuckets: [],
  topOutstandingPatients: [],
  patientFunnel: { registered: 0, hadVisit: 0, hadTreatmentPlan: 0, hadInvoice: 0, hadPayment: 0 },
  doctorBreakdown: [],
};

const T = { timeout: 3000 };

beforeEach(() => vi.clearAllMocks());

describe("ReportsPage", () => {
  it("shows skeleton while loading", async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<ReportsPage />);
    await waitFor(() =>
      expect(document.querySelector(".animate-pulse")).toBeTruthy(), T
    );
  });

  it("renders stat cards after data loads", async () => {
    mockGet.mockResolvedValue(REPORT_DATA);
    render(<ReportsPage />);
    expect(await screen.findByText("Total Patients", {}, T)).toBeTruthy();
  });

  it("shows error state when API fails", async () => {
    mockGet.mockRejectedValue(new Error("Server error"));
    render(<ReportsPage />);
    expect(await screen.findByText("Server error", {}, T)).toBeTruthy();
  });
});
