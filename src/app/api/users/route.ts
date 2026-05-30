import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role, email: users.email })
    .from(users);

  return NextResponse.json({ users: rows });
}
