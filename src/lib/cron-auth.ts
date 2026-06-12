/**
 * lib/cron-auth.ts
 *
 * Shared authentication for /api/cron/* routes.
 *
 * THREAT MODEL:
 *   Cloudflare's scheduled (cron) handler invokes these routes via an internal
 *   self-fetch inside the Worker, marked with the `x-cloudflare-cron` header.
 *   That header is NOT a secret — any external client can send it. Trusting it
 *   alone lets anyone on the internet trigger destructive jobs (e.g. the data
 *   retention purge) or spam jobs (reminder SMS).
 *
 * DISCRIMINATOR:
 *   Every request that arrives via Cloudflare's public edge carries
 *   `cf-connecting-ip` — Cloudflare sets/overwrites it and a client cannot
 *   remove it. The internal scheduled self-fetch never traverses the edge, so
 *   the header is absent. Therefore:
 *
 *     x-cloudflare-cron present AND cf-connecting-ip absent  → internal cron ✅
 *     Authorization: Bearer <CRON_SECRET>                     → manual/ops   ✅
 *     anything else                                           → 401          ❌
 *
 * USAGE:
 *   const denied = verifyCronAuth(req);
 *   if (denied) return denied;
 */
import { NextRequest, NextResponse } from "next/server";
import env from "@/lib/env";

export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const hasCronHeader = req.headers.get("x-cloudflare-cron") !== null;
  const cameFromEdge  = req.headers.get("cf-connecting-ip") !== null;
  const isInternalCron = hasCronHeader && !cameFromEdge;

  if (isInternalCron) return null;

  const cronSecret = env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
