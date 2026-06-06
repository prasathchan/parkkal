/**
 * api/index.ts
 *
 * The ONE place to import all API functions from.
 *
 * ─── QUICK REFERENCE ─────────────────────────────────────────────────────────
 *
 *   import { patientsApi }   from "@/api";   // patients.list(), .get(), .update()...
 *   import { visitsApi }     from "@/api";   // visits.list(), .items.add()...
 *   import { treatmentsApi } from "@/api";   // treatments.list(), .forVisit.link()...
 *
 * ─── ERROR HANDLING ──────────────────────────────────────────────────────────
 *
 *   All functions throw ApiError (not plain Error) when the server
 *   returns a non-2xx status. Catch it like this:
 *
 *   import { ApiError } from "@/api";
 *   try {
 *     await visitsApi.delete(id);
 *   } catch (e) {
 *     if (e instanceof ApiError) {
 *       console.log(e.status);   // HTTP status code, e.g. 422
 *       console.log(e.message);  // Server's error message
 *     }
 *   }
 *
 * ─── WHERE EACH FILE IS ──────────────────────────────────────────────────────
 *
 *   api/patients.ts      → patient CRUD + balance + emergency contacts
 *   api/visits.ts        → visit CRUD + items + payments + prescriptions + attachments
 *   api/treatments.ts    → treatment plan CRUD + visit linking
 *   api/_client.ts       → base fetch wrapper (internal, don't import directly)
 */

export { patientsApi } from "./patients";
export { visitsApi } from "./visits";
export { treatmentsApi } from "./treatments";
export { ApiError } from "./_client";
