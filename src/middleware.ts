import { NextRequest, NextResponse } from "next/server";
import { verifyOrgToken, verifyToken } from "@/lib/auth-edge";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/select-org/:path*"],
};
