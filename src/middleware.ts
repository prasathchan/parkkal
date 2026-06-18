import { NextRequest, NextResponse } from "next/server";
import { verifyOrgToken, verifyToken } from "@/lib/auth-edge";

// ── Content-Security-Policy ───────────────────────────────────────────────────
// Next.js 15 App Router injects inline scripts for hydration and RSC payloads,
// so script-src requires 'unsafe-inline'. 'unsafe-eval' is only needed in the
// Next.js dev server (hot reload, React refresh) — production builds never use
// eval, so we exclude it there to close that XSS vector.
const isDev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "connect-src 'self' https://api.resend.com",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Report violations to our own endpoint so we hear about CSP bypasses in production
  ...(isDev ? [] : ["report-uri /api/csp-report"]),
].join("; ");

// ── CORS ─────────────────────────────────────────────────────────────────────
// Restrict all /api/* routes to same-origin requests only.
// The app's canonical origin is APP_URL (Cloudflare Worker secret) or the request Host.
// In dev there is no strict origin enforcement (cross-tab tooling, Postman, etc.).
function getAllowedOrigin(request: NextRequest): string | null {
  const appUrl = process.env.APP_URL;
  if (appUrl) return appUrl;
  const host = request.headers.get("host");
  if (!host) return null;
  return isDev ? null : `https://${host}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── CORS: enforce same-origin for all API routes ──────────────────────────
  if (pathname.startsWith("/api/")) {
    const allowedOrigin = getAllowedOrigin(request);
    const requestOrigin = request.headers.get("origin");

    // Reject cross-origin preflight and requests from unknown origins (production only)
    if (!isDev && allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Respond to OPTIONS preflight immediately
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin ?? "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Superadmin-Token",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }
  }

  // Protect /dashboard routes using org session
  if (pathname.startsWith("/dashboard")) {
    const orgCookie = request.cookies.get("pkd_org_session");
    if (!orgCookie?.value) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const session = await verifyOrgToken(orgCookie.value);
    if (!session) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("pkd_org_session");
      return response;
    }
  }

  // Protect /select-org using pre-org session
  if (pathname.startsWith("/select-org")) {
    const preCookie = request.cookies.get("pkd_session");
    if (!preCookie?.value) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const session = await verifyToken(preCookie.value);
    if (!session) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("pkd_session");
      return response;
    }
  }

  // Redirect logged-in users away from login
  if (pathname === "/login") {
    const orgCookie = request.cookies.get("pkd_org_session");
    if (orgCookie?.value) {
      const session = await verifyOrgToken(orgCookie.value);
      if (session) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  const response = NextResponse.next();

  // ── CORS response header ────────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const allowedOrigin = getAllowedOrigin(request);
    if (allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      response.headers.set("Vary", "Origin");
    }
  }

  // ── Security headers ────────────────────────────────────────────────────────
  response.headers.set("Content-Security-Policy", CSP);

  // Prevent MIME-type sniffing (e.g. treating a JSON response as a script)
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Belt-and-suspenders framing protection (CSP frame-ancestors already handles this)
  response.headers.set("X-Frame-Options", "DENY");

  // Legacy XSS filter for old IE/Edge — harmless on modern browsers
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Don't send full Referrer to cross-origin destinations (hides patient paths)
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Disable hardware APIs that a dental clinic app has no use for
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Prevent this page from being embedded in a cross-origin context (Spectre, clickjacking).
  // COOP isolates this browsing context so cross-origin windows can't get a JS reference to it.
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  // Prevent other origins from loading resources served by this app (e.g. hotlinking our assets).
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  // COEP is intentionally NOT set to "require-corp" here.
  // That mode blocks any cross-origin sub-resource that lacks a CORP header — which would
  // silently break R2-hosted org logos and patient attachments served from a CDN domain,
  // since Cloudflare R2 public buckets do not add CORP: cross-origin by default.
  // If R2 is later configured to emit that header, flip this to "require-corp" to gain
  // Spectre memory-isolation benefits.
  response.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");

  // HSTS: tell browsers to always use HTTPS for this origin (1 year, include subdomains)
  // Only in production — in dev this would break http://localhost
  if (!isDev) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  return response;
}

export const config = {
  // Run on every page and API route so security headers (CSP, HSTS, COOP/CORP)
  // apply to the landing page, signup, forgot-password, and API responses —
  // not just the dashboard. Auth-redirect logic above is path-guarded, so
  // widening the matcher only adds headers elsewhere. Static assets skipped.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
