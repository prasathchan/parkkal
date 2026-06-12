/**
 * withInternalRoute() — wrapper for /api/internal/* (Pricing Console S2S).
 * Auth = Bearer INTERNAL_API_KEY (see internal-auth.ts). No user session,
 * no org scoping — these endpoints are cross-tenant by design and must only
 * ever be reachable by the console.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { checkInternalAuth } from "@/lib/internal-auth";
import { logger } from "@/lib/logger";

type DbInstance = ReturnType<typeof getDb>;
type Handler<P> = (req: NextRequest, ctx: { db: DbInstance }, params: P) => Promise<NextResponse>;

export function internalOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as Record<string, unknown>, { status });
}

export function internalError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function withInternalRoute<P = Record<string, never>>(route: string, handler: Handler<P>) {
  return async (req: NextRequest, routeCtx: { params: Promise<P> }): Promise<NextResponse> => {
    const auth = await checkInternalAuth(req);
    if (auth === "disabled") return internalError("Internal API not enabled on this environment.", 503);
    if (auth === "unauthorized") return internalError("Unauthorized", 401);

    try {
      const params = (await routeCtx.params) as P;
      return await handler(req, { db: getDb() }, params);
    } catch (err) {
      logger.forRoute(route).error("Internal API route failed", err);
      return internalError("Internal server error", 500);
    }
  };
}
