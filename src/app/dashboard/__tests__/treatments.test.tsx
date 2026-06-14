// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/api/export", () => ({ exportTreatments: vi.fn() }));
vi.mock("@/components/ui/tooth-chart", () => ({ ToothChart: () => null }));
vi.mock("@/components/treatments/NewTreatmentModal", () => ({ NewTreatmentModal: () => null }));
vi.mock("@/api", () => ({
  treatmentsApi: { list: vi.fn() },
  patientsApi:   { list: vi.fn() },
  authApi:       { me: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

import TreatmentsPage from "../treatments/page";
import { treatmentsApi, authApi } from "@/api";

const mockList = treatmentsApi.list as ReturnType<typeof vi.fn>;
const mockMe   = authApi.me        as ReturnType<typeof vi.fn>;

const TREATMENT = {
  id: "t1", patientName: "Kavya Nair", createdAt: Date.now(),
  status: "ACTIVE", totalCost: 8000, organizationId: "org1",
};

const T = { timeout: 3000 };

beforeEach(() => {
  vi.clearAllMocks();
  mockMe.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "Admin" } });
});

describe("TreatmentsPage", () => {
  it("shows loading state while fetching", async () => {
    mockList.mockReturnValue(new Promise(() => {}));
    render(<TreatmentsPage />);
    // SkeletonTable renders inside a loading div
    await waitFor(() =>
      expect(document.querySelector('[aria-label], .animate-pulse, [role="status"]')).toBeTruthy(), T
    );
  });

  it("renders treatment rows after data loads", async () => {
    mockList.mockResolvedValue({ treatments: [TREATMENT], total: 1 });
    render(<TreatmentsPage />);
    const matches = await screen.findAllByText("Kavya Nair", {}, T);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows empty state when no treatments", async () => {
    mockList.mockResolvedValue({ treatments: [], total: 0 });
    render(<TreatmentsPage />);
    expect(await screen.findByText("No treatment records found", {}, T)).toBeTruthy();
  });

});
