/**
 * lib/env.ts
 *
 * Validated environment configuration.
 *
 * WHY THIS EXISTS:
 *   Accessing process.env.X directly throughout the codebase means a missing
 *   or misnamed variable causes a silent runtime failure — often mid-request,
 *   deep in a stack trace, with no indication which variable was wrong.
 *
 *   This module validates all required env vars at import time using Zod.
 *   A misconfigured deployment fails immediately with a clear message like:
 *     "JWT_SECRET: Required" instead of a mystery 500 three API calls later.
 *
 * USAGE:
 *   import env from "@/lib/env";
 *   const token = jwt.sign(payload, env.JWT_SECRET);
 *
 * ADDING A NEW ENV VAR:
 *   1. Add it to the schema below with the appropriate Zod validator.
 *   2. Update .env.example and wrangler.jsonc [vars] / [secrets].
 *   3. Import from this file everywhere — never process.env.X directly.
 *
 * NOTE — Cloudflare Workers:
 *   In the Workers runtime, environment variables arrive as bindings on the
 *   `env` object, not via process.env. This module covers Node/local dev only.
 *   Worker-specific bindings (DB, KV, etc.) are typed via getCloudflareContext().
 */

import { z } from "zod";

const envSchema = z.object({
  // ── Auth ──────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // ── Encryption ────────────────────────────────────────────────────────────
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"),

  // ── Email (Resend) ────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().startsWith("re_", "RESEND_API_KEY must start with 're_'"),

  // ── SMS (Twilio) — optional: SMS is gracefully skipped when not configured ──
  TWILIO_ACCOUNT_SID: z.string().startsWith("AC").optional(),
  TWILIO_AUTH_TOKEN:  z.string().min(1).optional(),
  TWILIO_PHONE_NUMBER: z.string().startsWith("+").optional(),

  // ── Database (local dev only — D1 binding used in Workers) ───────────────
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL").optional(),

  // ── Cron ──────────────────────────────────────────────────────────────────
  CRON_SECRET: z.string().min(16).optional(),

  // ── Notifications ─────────────────────────────────────────────────────────
  RESEND_FROM_EMAIL: z.string().email().optional(),
  TWILIO_WHATSAPP_NUMBER: z.string().startsWith("whatsapp:+").optional(),

  // ── App URL ───────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // ── OAuth providers (optional) ────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),

  // ── AI ────────────────────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),

  // ── Runtime ───────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[env] Missing or invalid environment variables:\n${issues}\n\nCheck your .env.local file.`,
    );
  }
  return result.data;
}

// Validate once at module load. In Cloudflare Workers the module is initialised
// before any request arrives, so a bad config surfaces on deploy not on first request.
const env: Env = validateEnv();

export default env;
