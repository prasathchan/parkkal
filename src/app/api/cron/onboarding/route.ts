/**
 * GET /api/cron/onboarding
 *
 * Sends pending onboarding emails for new clinic accounts.
 * Runs daily at 02:00 UTC via Cloudflare Workers Cron Triggers.
 *
 * ─── SECURITY ─────────────────────────────────────────────────────────────────
 *   Requires  Authorization: Bearer <CRON_SECRET>
 *   OR Cloudflare cron delivery (x-cloudflare-cron header present).
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { processOnboardingEmails } from "@/lib/onboarding-emails";
import env from "@/lib/env";

export async function GET(request: NextRequest) {
  const isCron = request.headers.has("x-cloudflare-cron");
  if (!isCron) {
    const auth = request.headers.get("authorization") ?? "";
    if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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
