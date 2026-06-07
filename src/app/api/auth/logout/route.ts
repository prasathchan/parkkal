import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const LOGOUT_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(`logout:${ip}`, LOGOUT_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

  const response = NextResponse.json({ success: true });
  response.cookies.delete("pkd_session");
  response.cookies.delete("pkd_org_session");
  return response;
}
