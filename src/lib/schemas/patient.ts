/**
 * lib/schemas/patient.ts
 *
 * Zod schemas for patient-related API routes.
 * Used by both POST /api/patients and PATCH /api/patients/[id].
 *
 * ADDING A NEW FIELD:
 *   1. Add it to the schema below.
 *   2. Update the DB schema (src/db/schema.ts) + write a migration.
 *   3. Update the TypeScript type (src/types/patient.ts).
 *   4. The route handlers pick it up automatically via .parse().
 */

import { z } from "zod";
import { indianPhoneSchema, isoDateSchema, idSchema, textFields } from "./common";

// ─── Blood group ──────────────────────────────────────────────────────────────

export const BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
  "A1+", "A1-", "A2+", "A2-", "A1B+", "A1B-", "A2B+", "A2B-",
  "Bombay Oh", "UNKNOWN",
] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

// ─── Gender ───────────────────────────────────────────────────────────────────

export const GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;
export type Gender = (typeof GENDERS)[number];

// ─── Create patient schema ────────────────────────────────────────────────────

/**
 * Schema for POST /api/patients.
 * Validates and coerces the request body before it touches the DB.
 */
export const createPatientSchema = z.object({
  name:          textFields.name,
  phone:         indianPhoneSchema,
  email:         z.string().email("Invalid email address").optional().or(z.literal("")),
  dateOfBirth:   isoDateSchema.optional(),
  gender:        z.enum(GENDERS).optional(),
  bloodGroup:    z.enum(BLOOD_GROUPS).optional(),
  medicalHistory: z.string().max(2000, "Medical history is too long").optional(),
  referralSource: z.string().max(255).optional(),
  address:       z.string().max(1000).optional(),
  panNumber:     z.string().max(10).optional(),
  aadhaarNumber: z.string().length(12).optional(),
  referredByPatientId: z.string().optional().nullable(),
  // Emergency contact (optional at creation)
  emergencyContact: z.object({
    name:         textFields.name,
    phone:        indianPhoneSchema,
    relationship: z.string().max(100),
    email:        z.string().email().optional().or(z.literal("")),
  }).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

// ─── Update patient schema ────────────────────────────────────────────────────

/**
 * Schema for PATCH /api/patients/[id].
 * All fields are optional — partial update pattern.
 */
export const updatePatientSchema = createPatientSchema.partial().omit({
  emergencyContact: true,
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

// ─── List patients query schema ───────────────────────────────────────────────

export const listPatientsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

// ─── Emergency contact schema ─────────────────────────────────────────────────

export const createEmergencyContactSchema = z.object({
  entityType:   z.enum(["PATIENT", "USER"]),
  entityId:     idSchema,
  name:         textFields.name,
  relationship: z.string().min(1).max(100),
  phone:        indianPhoneSchema,
  email:        z.string().email().optional().or(z.literal("")),
  isPrimary:    z.boolean().default(false),
});

export type CreateEmergencyContactInput = z.infer<typeof createEmergencyContactSchema>;
