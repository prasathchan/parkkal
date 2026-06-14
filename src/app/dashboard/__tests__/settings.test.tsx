// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link",  () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
// eslint-disable-next-line @next/next/no-img-element -- test mock for next/image; a plain <img> is the point
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));
vi.mock("@/context/toast-context", () => ({ useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }) }));
vi.mock("@/components/ui/address-form", () => ({
  AddressForm: () => null,
  EMPTY_ADDRESS: { line1: "", city: "", state: "", pincode: "", country: "India" },
}));
vi.mock("@/lib/address", () => ({
  parseAddress:     vi.fn(() => ({ line1: "", city: "", state: "", pincode: "", country: "India" })),
  serializeAddress: vi.fn(() => ""),
  EMPTY_ADDRESS:    { line1: "", city: "", state: "", pincode: "", country: "India" },
}));
vi.mock("@/lib/theme", () => ({
  DEFAULT_THEME:    { primaryColor: "#2563eb", font: "Inter", borderRadius: "md" },
  COLOR_PRESETS:    [],
  FONT_OPTIONS:     [],
  parseThemeConfig: vi.fn(() => ({ primaryColor: "#2563eb", font: "Inter", borderRadius: "md" })),
}));
vi.mock("@/api", () => ({
  orgApi:  {
    getProfile:    vi.fn(),
    updateProfile: vi.fn(),
    uploadLogo:    vi.fn(),
    deleteLogo:    vi.fn(),
    members:       { list: vi.fn() },
  },
  authApi: { me: vi.fn(), changePassword: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

import SettingsPage from "../settings/page";
import { orgApi } from "@/api";

const mockProfile = orgApi.getProfile  as ReturnType<typeof vi.fn>;
const mockMembers = orgApi.members.list as ReturnType<typeof vi.fn>;

const ORG = {
  id: "org1", name: "Parkkal Dental", tagline: "Your smile, our care",
  phone: "9876543210", email: "info@parkkal.com", address: "",
  gstin: "", gstRegistered: false, themeConfig: null, logoUrl: null,
};

const T = { timeout: 3000 };

beforeEach(() => {
  vi.clearAllMocks();
  mockMembers.mockResolvedValue({ members: [] });
});

describe("SettingsPage", () => {
  it("shows loading text while fetching profile", async () => {
    mockProfile.mockReturnValue(new Promise(() => {}));
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText(/loading/i)).toBeTruthy(), T);
  });

  it("renders org name after profile loads", async () => {
    mockProfile.mockResolvedValue({ organization: ORG });
    render(<SettingsPage />);
    expect(await screen.findByDisplayValue("Parkkal Dental", {}, T)).toBeTruthy();
  });

});
