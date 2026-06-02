import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizations } from "@/db/schema";
import { getSession } from "@/lib/auth";

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { confirmName?: string };
  if (!body.confirmName) return NextResponse.json({ error: "Confirmation required" }, { status: 400 });

  const db = getDb();
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, session.orgId));

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  if (body.confirmName.trim() !== org.name.trim()) {
    return NextResponse.json({ error: "Organization name does not match" }, { status: 400 });
  }

  const scheduledDeleteAt = Date.now() + FIFTEEN_DAYS_MS;

  await db.update(organizations)
    .set({ isActive: 0, scheduledDeleteAt, updatedAt: Date.now() })
    .where(eq(organizations.id, session.orgId));

  return NextResponse.json({ scheduledDeleteAt });
}
