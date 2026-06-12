/**
 * lib/index.ts
 *
 * Re-exports the most commonly used server-side utilities.
 * Only import from here in route handlers and other server-only files.
 *
 * ⚠️  NEVER import this file (or anything from src/lib/) in a "use client" component.
 *     Client components should only import from src/api/, src/hooks/, src/constants/, src/types/.
 *
 * QUICK REFERENCE — what lives where:
 *
 *   withRoute, apiOk, apiError, RATE_LIMITS  →  lib/api.ts
 *   getDb, runCascade                         →  lib/db.ts
 *   PERMISSIONS, hasPermission                →  lib/permissions.ts
 *   getSession, createToken, hashPassword     →  lib/auth.ts
 *   checkRateLimit                            →  lib/rate-limit.ts
 *   sendStaffInviteEmail, sendEmailOTP        →  lib/email.ts
 *   sendSMSOTP                                →  lib/sms.ts
 *   uploadFile, deleteFile                    →  lib/storage.ts
 *   encrypt, decrypt                          →  lib/encryption.ts
 *   generateOTP, hashOTP, verifyOTP           →  lib/otp.ts
 *   logger                                    →  lib/logger.ts
 *   writeAppLog                               →  lib/app-logger.ts
 *   writeAuditLog                             →  lib/audit.ts
 *   getBillingStatus                          →  lib/billing.ts
 *   env                                       →  lib/env.ts
 *   schemas                                   →  lib/schemas/index.ts
 */

// Core route infrastructure
export { withRoute, apiOk, apiError, RATE_LIMITS } from "./api";

// Database
export { getDb, runCascade } from "./db";
export type { DbInstance } from "./db";

// Auth
export { getSession, createToken, createOrgToken, hashPassword, verifyPassword } from "./auth";

// Permissions
export { PERMISSIONS, hasPermission } from "./permissions";
export type { Permission } from "./permissions";

// Logging
export { logger } from "./logger";
export { writeAppLog } from "./app-logger";
export { writeAuditLog } from "./audit";

// External services
export { sendStaffInviteEmail, sendEmailOTP } from "./email";
export { sendSMSOTP } from "./sms";
export { storeFile, getFile, deleteFile } from "./storage";
export type { StoredFile } from "./storage";

// Notifications (SMS, WhatsApp, Email)
export { sendNotification, buildReminderMessage } from "./notifications";
export type { NotificationChannel, SendNotificationParams, ReminderMessageParams } from "./notifications";

// Appointment reminders
export { scheduleReminders, rescheduleReminders, cancelReminders } from "./reminder-scheduler";

// Utilities
export { encryptField, decryptField } from "./encryption";
export { hashOTP, verifyOTP } from "./otp";
export { getBillingStatus, getBalanceDue, getTreatmentOutstanding } from "./billing";

// Env (validated config)
export { default as env } from "./env";

// Shared validation schemas
export * from "./schemas";
