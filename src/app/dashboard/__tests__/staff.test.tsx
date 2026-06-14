// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/ui/blood-group-select", () => ({ BloodGroupSelect: () => null }));
vi.mock("@/components/ui/address-form", () => ({
  AddressForm: () => null,
  EMPTY_ADDRESS: { line1: "", city: "", state: "", pincode: "", country: "India" },
}));
vi.mock("@/lib/address", () => ({
  serializeAddress: vi.fn(() => ""),
  EMPTY_ADDRESS: { line1: "", city: "", state: "", pincode: "", country: "India" },
}));
vi.mock("@/api", () => ({
  orgApi: {
    members: { list: vi.fn(), update: vi.fn() },
    roles:   { list: vi.fn() },
  },
  ApiError: class ApiError extends Error {},
}));

import StaffPage from "../staff/page";
import { orgApi } from "@/api";

const mockMembersList = orgApi.members.list as ReturnType<typeof vi.fn>;
const mockRolesList   = orgApi.roles.list   as ReturnType<typeof vi.fn>;

const MEMBER = {
  memberId: "m1", userId: "u1", name: "Dr. Ramesh", email: "ramesh@clinic.com",
  phone: "9876543210", role: "DOCTOR", isDoctor: 1, isActive: 1,
  orgRoleId: "r1", orgRoleName: "Doctor", organizationId: "org1",
};

const T = { timeout: 3000 };

beforeEach(() => {
  vi.clearAllMocks();
  mockRolesList.mockResolvedValue({ roles: [] });
});

describe("StaffPage", () => {
  it("shows loading indicator while fetching", async () => {
    mockMembersList.mockReturnValue(new Promise(() => {}));
    render(<StaffPage />);
    await waitFor(() => expect(screen.getByText(/loading staff/i)).toBeTruthy(), T);
  });

  it("renders staff member rows after data loads", async () => {
    mockMembersList.mockResolvedValue({ members: [MEMBER] });
    render(<StaffPage />);
    expect(await screen.findByText("Dr. Ramesh", {}, T)).toBeTruthy();
  });

  it("shows empty state when no staff", async () => {
    mockMembersList.mockResolvedValue({ members: [] });
    render(<StaffPage />);
    expect(await screen.findByText("No staff members yet", {}, T)).toBeTruthy();
  });
});
