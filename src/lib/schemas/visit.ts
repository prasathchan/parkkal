/**
 * lib/schemas/visit.ts
 *
 * Zod schemas for visit-related API routes.
 *
 * These schemas are the authoritative source of what the API accepts.
 * Both the route handler and the TypeScript client types are derived from them.
 *
 * ADDING A NEW VISIT FIELD:
 *   1. Add it to the appropriate schema below.
 *   2. Add it to the `allowed` list in the PATCH route handler.
 *   3. Update src/types/visit.ts if a new field is returned in responses.
 */

import { z } from "zod";
import { idSchema, isoDateSchema, positiveMoneySchema, moneySchema, textFields } from "./common";
import { VISIT_STATUS, ITEM_CATEGORY, PAYMENT_METHOD } from "@/constants";

// ─── Create visit ─────────────────────────────────────────────────────────────

export const createVisitSchema = z.object({
  patientId:      idSchema,
  doctorId:       idSchema,
  visitDate:      isoDateSchema,
  visitType:      z.enum(["WALK_IN", "APPOINTMENT"]).default("WALK_IN"),
  chiefComplaint: textFields.shortNotes,
  appointmentId:  z.string().optional(),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;

// ─── Update visit (PATCH) ─────────────────────────────────────────────────────

export const updateVisitSchema = z.object({
  chiefComplaint: z.string().max(500).optional(),
  doctorNotes:    z.string().max(5000).optional(),
  diagnosis:      z.string().max(1000).optional(),
  status:         z.enum([VISIT_STATUS.OPEN, VISIT_STATUS.COMPLETED, VISIT_STATUS.CANCELLED]).optional(),
  visitDate:      isoDateSchema.optional(),
  recallDate:     isoDateSchema.nullable().optional(),
  recallNotes:    z.string().max(500).nullable().optional(),
}).strict(); // .strict() rejects unknown keys — prevents accidental field injection

export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;

// ─── Visit items ──────────────────────────────────────────────────────────────

export const createVisitItemSchema = z.object({
  itemName:          z.string().min(1, "Item name is required").max(255),
  category:          z.enum([
    ITEM_CATEGORY.MEDICINE,
    ITEM_CATEGORY.PROCEDURE,
    ITEM_CATEGORY.XRAY,
    ITEM_CATEGORY.CONSULTATION,
    ITEM_CATEGORY.TREATMENT,
    ITEM_CATEGORY.OTHER,
  ]),
  toothNumber:       z.string().max(10).optional(),
  quantity:          z.number().positive("Quantity must be positive"),
  unitPrice:         moneySchema,
  notes:             z.string().max(500).optional(),
  linkedTreatmentId: z.string().optional(),
});

export type CreateVisitItemInput = z.infer<typeof createVisitItemSchema>;

// ─── Payments ─────────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  amount:          positiveMoneySchema,
  paymentMethod:   z.enum([
    PAYMENT_METHOD.CASH,
    PAYMENT_METHOD.CARD,
    PAYMENT_METHOD.UPI,
    PAYMENT_METHOD.BANK_TRANSFER,
  ]),
  referenceNumber: z.string().max(100).nullable().optional(),
  notes:           z.string().max(500).nullable().optional(),
  treatmentId:     z.string().nullable().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ─── List visits query ────────────────────────────────────────────────────────

export const listVisitsQuerySchema = z.object({
  patientId:     z.string().optional(),
  status:        z.enum([VISIT_STATUS.OPEN, VISIT_STATUS.COMPLETED, VISIT_STATUS.CANCELLED]).optional(),
  billingStatus: z.enum(["PAID", "PARTIAL", "PENDING"]).optional(),
  date:          isoDateSchema.optional(),
  search:        z.string().max(100).optional(),
  limit:         z.coerce.number().int().min(1).max(200).default(25),
  offset:        z.coerce.number().int().min(0).default(0),
});

export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;
