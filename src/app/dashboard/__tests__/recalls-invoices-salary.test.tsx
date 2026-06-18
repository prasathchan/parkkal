// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/api", () => ({
  recallsApi:  { list: vi.fn() },
  invoicesApi: { list: vi.fn() },
  patientsApi: { list: vi.fn() },
  orgApi: { salary: { list: vi.fn(), generate: vi.fn(), markPaid: vi.fn() } },
  ApiError: class ApiError extends Error {},
}));

import RecallsPage  from "../recalls/page";
import InvoicesPage from "../invoices/page";
import SalaryPage   from "../salary/page";
import { recallsApi, invoicesApi, orgApi, patientsApi } from "@/api";

const mockRecalls  = recallsApi.list    as ReturnType<typeof vi.fn>;
const mockInvoices = invoicesApi.list   as ReturnType<typeof vi.fn>;
const mockSalary   = orgApi.salary.list as ReturnType<typeof vi.fn>;
const mockPatients = patientsApi.list   as ReturnType<typeof vi.fn>;

const T = { timeout: 3000 };

beforeEach(() => vi.clearAllMocks());

// ─── Recalls ─────────────────────────────────────────────────────────────────

describe("RecallsPage", () => {
  const RECALL = {
    id: "rc1", patientId: "p1", patientName: "Sunita Verma",
    visitId: "v1", visitDate: "2026-01-15",
    recallDate: "2026-07-01",
    status: "OPEN",              // visit status
    recallStatus: "UNSCHEDULED", // computed recall status
    isOverdue: false, daysUntilRecall: 19,
  };

  it("shows skeleton while loading", async () => {
    mockRecalls.mockReturnValue(new Promise(() => {}));
    render(<RecallsPage />);
    await waitFor(() =>
      expect(document.querySelector('[role="status"]')).toBeTruthy(), T
    );
  });

  it("renders recall rows after data loads", async () => {
    mockRecalls.mockResolvedValue({ recalls: [RECALL], total: 1 });
    render(<RecallsPage />);
    const matches = await screen.findAllByText("Sunita Verma", {}, T);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows empty state when no recalls", async () => {
    mockRecalls.mockResolvedValue({ recalls: [], total: 0 });
    render(<RecallsPage />);
    expect(await screen.findByText("No recalls found", {}, T)).toBeTruthy();
  });
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

describe("InvoicesPage", () => {
  const INVOICE = {
    id: "inv1", patientId: "p1", patientName: "Anil Menon",
    totalAmount: 3000, paidAmount: 3000, status: "PAID",
    invoiceNumber: "INV-001", createdAt: Date.now(), organizationId: "org1",
  };

  beforeEach(() => {
    mockPatients.mockResolvedValue({ patients: [], total: 0 });
  });

  it("shows skeleton while fetching", async () => {
    mockInvoices.mockReturnValue(new Promise(() => {}));
    render(<InvoicesPage />);
    await waitFor(() => expect(document.querySelector('[role="status"]')).toBeTruthy(), T);
  });

  it("renders invoice rows after data loads", async () => {
    mockInvoices.mockResolvedValue({ invoices: [INVOICE] });
    render(<InvoicesPage />);
    const matches = await screen.findAllByText("Anil Menon", {}, T);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows empty state when no invoices", async () => {
    mockInvoices.mockResolvedValue({ invoices: [] });
    render(<InvoicesPage />);
    expect(await screen.findByText("No invoices found", {}, T)).toBeTruthy();
  });
});

// ─── Salary ───────────────────────────────────────────────────────────────────

describe("SalaryPage", () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const RECORD = {
    id: "sr1", userId: "u1", userName: "Dr. Ramesh", userEmail: "ramesh@parkkal.com",
    month: currentMonth, salaryType: "FIXED", salaryAmount: 50000,
    paidAmount: 0, status: "PENDING", appointmentCount: 0,
  };

  it("shows skeleton while fetching", async () => {
    mockSalary.mockReturnValue(new Promise(() => {}));
    render(<SalaryPage />);
    await waitFor(() => expect(document.querySelector('[role="status"]')).toBeTruthy(), T);
  });

  it("renders salary records after data loads", async () => {
    mockSalary.mockResolvedValue({ records: [RECORD] });
    render(<SalaryPage />);
    const matches = await screen.findAllByText("Dr. Ramesh", {}, T);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows empty state when no records", async () => {
    mockSalary.mockResolvedValue({ records: [] });
    render(<SalaryPage />);
    expect(
      await screen.findByText(/no salary records for/i, {}, T)
    ).toBeTruthy();
  });
});
