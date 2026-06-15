// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/api/export", () => ({ exportVisits: vi.fn() }));
vi.mock("@/api", () => ({
  visitsApi: { list: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

import VisitsPage from "../visits/page";
import { visitsApi } from "@/api";

const mockList = visitsApi.list as ReturnType<typeof vi.fn>;

const VISIT = {
  id: "v1", visitDate: "2026-06-01", status: "OPEN",
  patientName: "Priya Sharma", totalAmount: 1500, paidAmount: 0,
  organizationId: "org1", createdAt: Date.now(),
};

const T = { timeout: 3000 };

beforeEach(() => vi.clearAllMocks());

describe("VisitsPage", () => {
  it("shows skeleton while loading", async () => {
    mockList.mockReturnValue(new Promise(() => {}));
    render(<VisitsPage />);
    await waitFor(() =>
      expect(document.querySelector(".skeleton")).toBeTruthy(), T
    );
  });

  it("renders visit rows after data loads", async () => {
    mockList.mockResolvedValue({ visits: [VISIT], total: 1 });
    render(<VisitsPage />);
    const matches = await screen.findAllByText("Priya Sharma", {}, T);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows empty state when no visits", async () => {
    mockList.mockResolvedValue({ visits: [], total: 0 });
    render(<VisitsPage />);
    expect(await screen.findByText("No visits yet", {}, T)).toBeTruthy();
  });

  it("renders New Visit link", async () => {
    mockList.mockResolvedValue({ visits: [], total: 0 });
    render(<VisitsPage />);
    await waitFor(() =>
      expect(document.querySelector('a[href="/dashboard/visits/new"]')).toBeTruthy(), T
    );
  });

  it("shows load-more button when more results exist", async () => {
    const manyVisits = Array.from({ length: 50 }, (_, i) => ({ ...VISIT, id: `v${i}` }));
    mockList.mockResolvedValue({ visits: manyVisits, total: 120 });
    render(<VisitsPage />);
    expect(await screen.findByRole("button", { name: /load more/i }, T)).toBeTruthy();
  });
});
