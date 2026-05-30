import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("pkd_session");
  response.cookies.delete("pkd_org_session");
  return response;
}
