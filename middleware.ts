import { NextRequest, NextResponse } from "next/server";
import { verifyOrgToken } from "@/lib/auth-edge";

/**
 * Centralized auth gate — defense-in-depth layer on top of per-route session checks.
 *
 * Why this exists: every API route calls getSession() individually, but if a new
 * route is added without that call, it would be unauthenticated by default. This
 * middleware acts as a safety net: it rejects requests that have no valid
 * pkd_org_session before they ever reach a route handler.
 *
 * Scope:
 *   /api/*            → 401 JSON if no valid org session (except /api/auth/*)
 *   /dashboard/*      → redirect to /login if no valid org session
 *
 * The per-route getSession() calls remain in place for org-scoping — this layer
 * only checks that a session exists, not which org it belongs to.
 */

// All /api/auth/* routes are public by definition (login, signup, verify, etc.)
const PUBLIC_API_PREFIX = "/api/auth/";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Pass all auth routes through without checking
  if (pathname.startsWith(PUBLIC_API_PREFIX)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("pkd_org_session")?.value;

  // Fast path: no cookie at all
  if (!token) {
    return reject(request);
  }

  // Verify the JWT (uses jose — fully edge-compatible)
  const session = await verifyOrgToken(token);
  if (!session) {
    return reject(request);
  }

  return NextResponse.next();
}

function reject(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Dashboard page — redirect to login, preserve destination for post-login redirect
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Covers /dashboard and /dashboard/anything
    // Covers /api/anything (not /api/auth/*)  — public prefix handled above
    "/(dashboard|api)(.*)",
  ],
};
