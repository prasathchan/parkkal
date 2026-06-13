/**
 * GET /api/cron/onboarding
 *
 * Sends pending onboarding emails for new clinic accounts.
 * Runs daily at 02:00 UTC via Cloudflare Workers Cron Triggers.
 *
 * ─── SECURITY ─────────────────────────────────────────────────────────────────
 *   Authenticated via verifyCronAuth (see src/lib/cron-auth.ts):
 *     - Cloudflare's internal cron self-fetch (x-cloudflare-cron present AND
 *       cf-connecting-ip absent), OR
 *     - Authorization: Bearer <CRON_SECRET> for manual/ops invocation.
 *   NOTE: x-cloudflare-cron alone is NOT trusted — it is spoofable by any public
 *   client, so the cf-connecting-ip discriminator is required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { processOnboardingEmails } from "@/lib/onboarding-emails";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const denied = verifyCronAuth(request);
  if (denied) return denied;

  const log = logger.forRoute("GET /api/cron/onboarding");
  const db = getDb();

  try {
    const { sent, failed } = await processOnboardingEmails(db);
    log.info("Onboarding email cron complete", { sent, failed });
    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    log.error("Onboarding email cron error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
