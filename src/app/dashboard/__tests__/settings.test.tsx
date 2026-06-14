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
vi.mock("@/lib/theme", () => {
  const DEFAULT_THEME = { accentName: "Temple Gold", fontFamily: "inter", darkMode: "light", primaryColor: "#0B6E6E", sidebarStyle: "dark" };
  const PARKKAL_ACCENT_SET = [
    { name: "Temple Gold", value: "#C8873A", action: "#A86E2C" },
    { name: "Clay Rose", value: "#B55D63", action: "#994B50" },
  ];
  return {
    DEFAULT_THEME,
    PARKKAL_ACCENT_SET,
    COLOR_PRESETS:    PARKKAL_ACCENT_SET.map((a) => ({ name: a.name, value: a.value })),
    FONT_OPTIONS:     [],
    getAccent:        (name: string) => PARKKAL_ACCENT_SET.find((a) => a.name === name) ?? PARKKAL_ACCENT_SET[0],
    getAccentCssVars: vi.fn(() => ({})),
    parseThemeConfig: vi.fn(() => DEFAULT_THEME),
  };
});
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
