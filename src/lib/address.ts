import type { AddressValue } from "@/components/ui/address-form";

export const EMPTY_ADDRESS: AddressValue = {
  country: "India",
  state: "",
  district: "",
  city: "",
  pincode: "",
  fullAddress: "",
};

export function parseAddress(raw: string | null | undefined): AddressValue {
  if (!raw) return { ...EMPTY_ADDRESS };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "country" in parsed) {
      return { ...EMPTY_ADDRESS, ...parsed };
    }
  } catch {
    // Legacy plain string — keep as fullAddress
  }
  return { ...EMPTY_ADDRESS, fullAddress: raw };
}

export function serializeAddress(a: AddressValue): string {
  return JSON.stringify(a);
}

export function formatAddressDisplay(a: AddressValue): string {
  const parts = [
    a.fullAddress,
    a.city,
    a.district,
    a.state ? (a.pincode ? `${a.state} - ${a.pincode}` : a.state) : "",
    a.country,
  ].filter(Boolean);
  return parts.join(", ");
}
