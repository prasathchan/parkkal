/**
 * lib/utils.ts
 *
 * Small helper functions used throughout the app.
 * These are all pure functions — no database, no API calls.
 *
 *  cn()                  → merge Tailwind CSS class names
 *  formatCurrency(1500)  → "₹1,500"
 *  formatDate(timestamp) → "01 Jan 2025"
 *  calculateAge("1990-06-15") → 35
 *  formatDoctorName("Ravi Kumar") → "Dr. Ravi Kumar"
 *  generatePatientCode(42) → "PKL-000042"
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
