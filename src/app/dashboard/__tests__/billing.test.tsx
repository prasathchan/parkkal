// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/billing/BillingPaymentModal", () => ({
  BillingPaymentModal: () => null,
}));
vi.mock("@/api", () => ({
  visitsApi: { list: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

import BillingPage from "../billing/page";
import { visitsApi } from "@/api";

const mockList = visitsApi.list as ReturnType<typeof vi.fn>;

const OPEN_VISIT = {
  id: "v1", visitDate: "2026-06-01", status: "OPEN",
  patientName: "Ravi Patel", totalAmount: 2000, paidAmount: 500,
  organizationId: "org1", createdAt: Date.now(),
};

const T = { timeout: 3000 };

beforeEach(() => vi.clearAllMocks());

describe("BillingPage", () => {
  it("shows loading indicator while fetching", async () => {
    mockList.mockReturnValue(new Promise(() => {}));
    render(<BillingPage />);
    await waitFor(() => expect(screen.getByText(/loading…/i)).toBeTruthy(), T);
  });

  it("renders unpaid visit rows", async () => {
    mockList.mockResolvedValue({ visits: [OPEN_VISIT], total: 1 });
    render(<BillingPage />);
    const matches = await screen.findAllByText("Ravi Patel", {}, T);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows empty state when no visits", async () => {
    mockList.mockResolvedValue({ visits: [], total: 0 });
    render(<BillingPage />);
    expect(await screen.findByText("No visits found", {}, T)).toBeTruthy();
  });

  it("shows error state when API fails", async () => {
    mockList.mockRejectedValue(new Error("Server error"));
    render(<BillingPage />);
    const matches = await screen.findAllByText(/failed to load/i, {}, T);
    expect(matches.length).toBeGreaterThan(0);
  });
});
