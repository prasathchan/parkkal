/**
 * API Route: POST /api/auth/logout
 *
 * Clears both session cookies AND writes the org session token's jti to the
 * revoked_tokens table. This ensures the token is rejected immediately on any
 * subsequent request — even before its natural 24-hour expiry.
 *
 * The revocation is fire-and-forget: if D1 is unavailable, we still clear the
 * cookies. The token will expire naturally within 24h in the worst case.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSession, revokeToken } from "@/lib/auth";

const LOGOUT_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(`logout:${ip}`, LOGOUT_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

  // Revoke the org session token so it can't be reused after logout.
  // jti is present on all tokens issued after migration 0029.
  const session = await getSession(request);
  if (session?.jti) {
    // Token expires 24h from issue time; we don't know exact issue time here,
    // so we use now + 24h as a conservative upper bound for the revocation entry.
    const expiresAt = Date.now() + 24 * 60 * 60_000;
    await revokeToken(session.jti, expiresAt);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("pkd_session");
  response.cookies.delete("pkd_org_session");
  return response;
}
