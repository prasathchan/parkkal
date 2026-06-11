/**
 * api/index.ts — The ONE place to import all API functions from.
 *
 * ─── HOW TO USE ──────────────────────────────────────────────────────────────
 *
 *   import { patientsApi, ApiError } from "@/api";
 *
 *   // List patients
 *   const { patients } = await patientsApi.list({ search: "kumar", limit: 25 });
 *
 *   // Create a patient
 *   try {
 *     const { patient } = await patientsApi.create({ name: "Raj", phone: "9876543210" });
 *   } catch (err) {
 *     if (err instanceof ApiError) {
 *       console.log(err.status);   // 400
 *       console.log(err.message);  // "Phone number already registered"
 *       console.log(err.details);  // [{ path: ["phone"], message: "..." }]
 *     }
 *   }
 *
 * ─── WHICH MODULE COVERS WHAT ─────────────────────────────────────────────────
 *
 *   patientsApi       patients.ts   → list, get, create, update, delete, balance
 *   visitsApi         visits.ts     → list, get, create, update, delete
 *                                     .items.add / .delete
 *                                     .payments.add
 *                                     .prescriptions.add / .delete
 *                                     .attachments.add / .delete
 *   treatmentsApi     treatments.ts → list, get, create, update, delete, getVisits
 *                                     .forVisit.list / .link / .unlink
 *                                     .consent.upload / .override
 *   appointmentsApi   appointments.ts → list, get, create, updateStatus
 *   orgApi            org.ts        → getProfile, updateProfile, uploadLogo, deleteLogo, delete
 *                                     .members.list / .add / .update / .sendActivation
 *                                     .roles.list / .create / .update / .delete / .migrate
 *                                     .salary.list
 *   authApi           auth.ts       → login, logout, me, changePassword
 *   invoicesApi       invoices.ts   → list, get, create
 *   recallsApi        recalls.ts    → list
 *   reportsApi        reports.ts    → get
 *   usersApi          users.ts      → get, update
 *   adminApi          admin.ts      → auditLog.list, appLogs.list
 *   emergencyContactsApi  emergency-contacts.ts → list, add, delete
 *
 * ─── ERROR HANDLING ──────────────────────────────────────────────────────────
 *
 *   All API functions throw ApiError (not plain Error) when the server returns
 *   a non-2xx status. Never catch a plain Error from these functions — it means
 *   there was a network failure or a JavaScript bug, not an API error.
 *
 *   import { ApiError } from "@/api";
 *
 *   try {
 *     await visitsApi.delete(id);
 *   } catch (err) {
 *     if (err instanceof ApiError) {
 *       // Server said no
 *       showError(err.message);
 *     } else {
 *       // Network failure or bug
 *       showError("Network error. Please try again.");
 *     }
 *   }
 */

export { adminApi } from "./admin";
export { emergencyContactsApi } from "./emergency-contacts";
export { patientsApi } from "./patients";
export { visitsApi } from "./visits";
export { treatmentsApi } from "./treatments";
export { appointmentsApi } from "./appointments";
export { invoicesApi } from "./invoices";
export { orgApi } from "./org";
export { authApi } from "./auth";
export { recallsApi } from "./recalls";
export { reportsApi } from "./reports";
export { usersApi } from "./users";

export { calendarApi } from "./calendar";
export { backupApi } from "./backup";

// The error class — always import this alongside the API you use
export { ApiError } from "./_client";
