/**
 * lib/schemas/index.ts
 *
 * Barrel export for all shared Zod validation schemas.
 *
 * IMPORT PATTERN:
 *   import { createPatientSchema, paginationSchema } from "@/lib/schemas";
 *
 * WHERE EACH SCHEMA LIVES:
 *   common.ts   → paginationSchema, indianPhoneSchema, isoDateSchema, moneySchema, textFields
 *   patient.ts  → createPatientSchema, updatePatientSchema, listPatientsQuerySchema
 *   visit.ts    → createVisitSchema, updateVisitSchema, createVisitItemSchema, createPaymentSchema
 *
 * ADDING A NEW SCHEMA FILE:
 *   1. Create src/lib/schemas/your-domain.ts
 *   2. Add `export * from "./your-domain"` below
 *   3. Use in your route handler: `const input = yourSchema.parse(await req.json())`
 */

export * from "./common";
export * from "./patient";
export * from "./visit";
