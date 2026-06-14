/**
 * Auth for /api/internal/* — server-to-server endpoints used exclusively by
 * the Parkkal Admin Console (admin.parkkal.com / admin.stg.parkkal.com).
 *
 * Security model:
 *   - A single long random bearer key per environment (INTERNAL_API_KEY).
 *   - When the key is NOT configured, every internal endpoint returns 503 —
 *     the surface simply does not exist until explicitly enabled.
 *   - Comparison is constant-time (HMAC trick) to avoid timing side channels.
 */

import type { NextRequest } from "next/server";
import env from "@/lib/env";

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const [da, db] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(a)),
    crypto.subtle.sign("HMAC", key, enc.encode(b)),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

export type InternalAuthResult = "ok" | "disabled" | "unauthorized";

export async function checkInternalAuth(req: NextRequest): Promise<InternalAuthResult> {
  const configured = env.INTERNAL_API_KEY;
  if (!configured) return "disabled";
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return "unauthorized";
  const presented = header.slice(7);
  return (await timingSafeEqual(presented, configured)) ? "ok" : "unauthorized";
}
