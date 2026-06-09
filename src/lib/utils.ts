/**
 * lib/utils.ts
 *
 * Small helper functions used throughout the app.
 * These are all pure functions — no database, no API calls.
 *
 *  cn()                       → merge Tailwind CSS class names
 *  formatCurrency(1500)       → "₹1,500"
 *  formatDate(timestamp)      → "01 Jan 2025"
 *  calculateAge("1990-06-15") → 35
 *  formatDoctorName("Ravi Kumar") → "Dr. Ravi Kumar"
 *  generatePatientCode(42)    → "PKL-000042"
 *  formatBytes(1536)          → "1.5 KB"
 *  escapeLike("50%")          → "50\\%"  (safe for SQL LIKE queries)
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(timestamp: number | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp as number));
}

export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generatePatientCode(count: number): string {
  return `PKL-${String(count).padStart(6, "0")}`;
}

export function formatDoctorName(name: string | null | undefined): string {
  if (!name) return "—";
  const stripped = name.replace(/^Dr\.?\s+/i, "");
  return `Dr. ${stripped}`;
}

/**
 * Format a raw byte count into a human-readable string.
 *
 * @example
 *   formatBytes(512)        → "512 B"
 *   formatBytes(1536)       → "1.5 KB"
 *   formatBytes(2097152)    → "2.0 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Escape SQL LIKE special characters in a user-supplied search string.
 *
 * Without escaping, a search for "50%" would match everything (% is a wildcard).
 * After escaping it becomes "50\%" which matches the literal string "50%".
 *
 * Returns null if the input is null/empty (so callers can skip the LIKE clause entirely).
 *
 * @example
 *   escapeLike("50%")  → "50\\%"
 *   escapeLike("_foo") → "\\_foo"
 *   escapeLike(null)   → null
 */
export function escapeLike(search: string | null | undefined): string | null {
  if (!search) return null;
  return search.replace(/[%_\\]/g, "\\$&");
}
