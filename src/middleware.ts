import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard routes
  if (pathname.startsWith("/dashboard")) {
    const cookie = request.cookies.get("pkd_session");
    if (!cookie?.value) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const session = await verifyToken(cookie.value);
    if (!session) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("pkd_session");
      return response;
    }
  }

  // Redirect logged-in users away from login
  if (pathname === "/login") {
    const cookie = request.cookies.get("pkd_session");
    if (cookie?.value) {
      const session = await verifyToken(cookie.value);
      if (session) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
