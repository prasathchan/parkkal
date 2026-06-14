// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/api/export", () => ({ exportPatients: vi.fn() }));
vi.mock("@/api", () => ({
  patientsApi: { list: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

import PatientsPage from "../patients/page";
import { patientsApi } from "@/api";

const mockList = patientsApi.list as ReturnType<typeof vi.fn>;

const PATIENT = {
  id: "p1", patientCode: "PKL-001", name: "Arjun Kumar",
  phone: "9876543210", dateOfBirth: "1990-01-15", gender: "Male",
  organizationId: "org1", createdAt: Date.now(),
};

const T = { timeout: 3000 };

beforeEach(() => vi.clearAllMocks());

describe("PatientsPage", () => {
  it("shows skeleton while loading", async () => {
    mockList.mockReturnValue(new Promise(() => {}));
    render(<PatientsPage />);
    await waitFor(() =>
      expect(document.querySelector(".animate-pulse")).toBeTruthy(), T
    );
  });

  it("renders patient rows after data loads", async () => {
    mockList.mockResolvedValue({ patients: [PATIENT], total: 1, limit: 25, offset: 0 });
    render(<PatientsPage />);
    const matches = await screen.findAllByText("Arjun Kumar", {}, T);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows empty state when no patients", async () => {
    mockList.mockResolvedValue({ patients: [], total: 0, limit: 25, offset: 0 });
    render(<PatientsPage />);
    expect(await screen.findByText(/no patients/i, {}, T)).toBeTruthy();
  });

  it("shows error state when API fails", async () => {
    mockList.mockRejectedValue(new Error("Network error"));
    render(<PatientsPage />);
    expect(await screen.findByText(/failed to load patients/i, {}, T)).toBeTruthy();
  });

  it("renders New Patient link", async () => {
    mockList.mockResolvedValue({ patients: [], total: 0, limit: 25, offset: 0 });
    render(<PatientsPage />);
    await waitFor(() =>
      expect(document.querySelector('a[href="/dashboard/patients/new"]')).toBeTruthy(), T
    );
  });

  it("re-fetches when search input changes", async () => {
    mockList.mockResolvedValue({ patients: [], total: 0, limit: 25, offset: 0 });
    render(<PatientsPage />);
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1), T);
    const input = screen.getByPlaceholderText(/search by name/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "Arjun" } });
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(mockList).toHaveBeenCalledTimes(2);
  });
});
