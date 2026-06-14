// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/context/toast-context", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/api", () => ({
  orgApi: { roles: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), migrate: vi.fn() } },
  ApiError: class ApiError extends Error {},
}));

import RolesPage from "../roles/page";
import { orgApi } from "@/api";

const mockList = orgApi.roles.list as ReturnType<typeof vi.fn>;

const ROLE = {
  id: "r1", name: "Senior Doctor", description: "Lead physician",
  color: "#8B5CF6", permissions: ["patients.view", "visits.view"],
  isSystem: false, userCount: 0, organizationId: "org1",
};

const T = { timeout: 3000 };

beforeEach(() => vi.clearAllMocks());

describe("RolesPage", () => {
  it("shows skeleton while loading", async () => {
    mockList.mockReturnValue(new Promise(() => {}));
    render(<RolesPage />);
    await waitFor(() =>
      expect(document.querySelector(".animate-pulse")).toBeTruthy(), T
    );
  });

  it("renders role cards after data loads", async () => {
    mockList.mockResolvedValue({ roles: [ROLE] });
    render(<RolesPage />);
    expect(await screen.findByText("Senior Doctor", {}, T)).toBeTruthy();
  });

  it("shows empty state when no custom roles", async () => {
    mockList.mockResolvedValue({ roles: [] });
    render(<RolesPage />);
    expect(await screen.findByText("No roles yet", {}, T)).toBeTruthy();
  });

  it("shows New Role button", async () => {
    mockList.mockResolvedValue({ roles: [] });
    render(<RolesPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /new role/i })).toBeTruthy(), T
    );
  });
});
