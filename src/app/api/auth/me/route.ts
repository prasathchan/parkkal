import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const log = logger.forRoute("GET /api/auth/me", session);
  log.info("Session fetched", { userId: session.userId });
  return NextResponse.json({ user: session });
}
