/**
 * lib/schemas/common.ts
 *
 * Reusable Zod building blocks shared across multiple API routes.
 *
 * HOW TO USE:
 *   import { paginationSchema, indianPhoneSchema } from "@/lib/schemas/common";
 *
 *   const querySchema = paginationSchema.extend({ search: z.string().optional() });
 *
 * WHY THIS FILE EXISTS:
 *   Without a shared schema library, every route that needs pagination redefines
 *   `limit: z.coerce.number().min(1).max(200).default(25)` independently.
 *   When the max changes, you'd have to update 15 files. Now you update one.
 */

import { z } from "zod";

// ─── Pagination ───────────────────────────────────────────────────────────────

/**
 * Standard pagination query params.
 * Use `.extend()` to add route-specific filters.
 *
 * @example
 *   const schema = paginationSchema.extend({
 *     search: z.string().optional(),
 *     status: z.enum(["OPEN", "COMPLETED"]).optional(),
 *   });
 *   const { limit, offset, search, status } = schema.parse(queryParams);
 */
export const paginationSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

// ─── Phone numbers ────────────────────────────────────────────────────────────

/**
 * Indian mobile phone number — accepts 10-digit, +91 prefixed, or 91-prefixed.
 * Always transforms to E.164 format (+91XXXXXXXXXX).
 *
 * @example
 *   indianPhoneSchema.parse("9876543210")   // → "+919876543210"
 *   indianPhoneSchema.parse("+919876543210") // → "+919876543210"
 */
export const indianPhoneSchema = z.string()
  .min(10, "Phone number must be at least 10 digits")
  .max(16, "Phone number is too long")
  .transform((p) => {
    const digits = p.replace(/\D/g, "");
    if (p.startsWith("+")) return p;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return p;
  });

// ─── Dates ───────────────────────────────────────────────────────────────────

/**
 * ISO date string — YYYY-MM-DD.
 * Rejects anything that doesn't match, including ISO datetime strings.
 *
 * @example
 *   isoDateSchema.parse("2025-06-09")      // → "2025-06-09" ✅
 *   isoDateSchema.parse("2025-06-09T10:00") // → ZodError ❌
 */
export const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/** Optional ISO date — same as isoDateSchema but can be undefined */
export const optionalIsoDateSchema = isoDateSchema.optional();

// ─── Entity IDs ───────────────────────────────────────────────────────────────

/**
 * Non-empty string ID (UUID or cuid).
 * Use this for any `patientId`, `visitId`, etc. field in a request body.
 */
export const idSchema = z.string().min(1, "ID is required");

// ─── Monetary amounts ─────────────────────────────────────────────────────────

/**
 * A non-negative monetary amount in INR (rupees).
 * Accepts fractional values (paise-level precision).
 *
 * @example
 *   moneySchema.parse(500)    // → 500   ✅
 *   moneySchema.parse(-1)     // → ZodError ❌
 *   moneySchema.parse(0)      // → 0     ✅ (₹0 is valid for free services)
 */
export const moneySchema = z.number()
  .min(0, "Amount cannot be negative")
  .finite("Amount must be a finite number");

/** A strictly positive monetary amount — use for payment amounts. */
export const positiveMoneySchema = z.number()
  .positive("Amount must be greater than zero")
  .finite("Amount must be a finite number");

// ─── Text field limits ────────────────────────────────────────────────────────

/**
 * Pre-built text field validators matching the DB column limits.
 * Use these instead of raw `z.string().max(N)` so limits stay consistent.
 */
export const textFields = {
  /** Short names — patient name, staff name, org name. */
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  /** Multi-line notes — doctor notes, chief complaint, etc. */
  notes: z.string().max(5000, "Notes are too long").optional(),
  /** Short single-line notes. */
  shortNotes: z.string().max(500, "Notes are too long").optional(),
  /** Free description field — treatment description, procedure notes. */
  description: z.string().min(1, "Description is required").max(1000, "Description is too long"),
} as const;
