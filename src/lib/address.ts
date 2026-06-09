/**
 * lib/address.ts
 *
 * Helpers for storing and displaying structured Indian addresses.
 *
 * Addresses are stored in the database as a JSON string so we can add new fields
 * without schema migrations. They look like:
 *   '{"country":"India","state":"Tamil Nadu","city":"Chennai","pincode":"600001","fullAddress":"12 Main St"}'
 *
 * Legacy rows may have a plain string address — parseAddress() handles both.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   EMPTY_ADDRESS          → a blank AddressValue with country pre-filled to "India"
 *   parseAddress(raw)      → DB string → AddressValue (handles legacy plain strings)
 *   serializeAddress(a)    → AddressValue → JSON string for storing in DB
 *   formatAddressDisplay(a)→ AddressValue → human-readable one-line string
 *
 * @example
 *   // Saving to DB:
 *   const json = serializeAddress(formValue);
 *   await db.update(patients).set({ address: json });
 *
 *   // Displaying:
 *   const addr = parseAddress(patient.address);
 *   formatAddressDisplay(addr); // → "12 Main St, Chennai, Tamil Nadu - 600001, India"
 */
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
