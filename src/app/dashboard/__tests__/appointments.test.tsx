// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/ui/add-to-calendar", () => ({ AddToCalendar: () => null }));
vi.mock("@/api", () => ({
  appointmentsApi: { list: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

import AppointmentsPage from "../appointments/page";
import { appointmentsApi } from "@/api";

const mockList = appointmentsApi.list as ReturnType<typeof vi.fn>;

// Use TODAY so the appointment always falls inside the current day/week view —
// a fixed past date drifts out of view as real time advances (date-fragile).
const TODAY_YMD = new Date().toISOString().slice(0, 10);

const APPOINTMENT = {
  id: "a1",
  patientId: "p1",
  patientName: "Meena Iyer",
  doctorId: "d1",
  doctorName: "Dr. Suresh",
  appointmentDate: TODAY_YMD,
  appointmentTime: "10:00",
  appointmentType: "CONSULTATION",
  status: "SCHEDULED",
  organizationId: "org1",
  createdAt: Date.now(),
};

beforeEach(() => vi.clearAllMocks());

describe("AppointmentsPage", () => {
  it("renders without crashing while loading", () => {
    mockList.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AppointmentsPage />);
    expect(container).toBeTruthy();
  });

  // Generous waits: CI on `main` runs with coverage instrumentation, which is
  // markedly slower than the plain test run — short waits race and flake there.
  it("renders appointment data after load", async () => {
    mockList.mockResolvedValue({ appointments: [APPOINTMENT], total: 1 });
    render(<AppointmentsPage />);
    const matches = await screen.findAllByText("Meena Iyer", {}, { timeout: 10000 });
    expect(matches.length).toBeGreaterThan(0);
  }, 15000);

  it("renders New Appointment link", async () => {
    mockList.mockResolvedValue({ appointments: [], total: 0 });
    render(<AppointmentsPage />);
    await waitFor(() =>
      expect(document.querySelector('a[href="/dashboard/appointments/new"]')).toBeTruthy(),
      { timeout: 10000 }
    );
  }, 15000);
});
