import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getDb } from "@/lib/db";
import { organizations } from "@/db/schema";
import { getSession } from "@/lib/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP, or SVG allowed" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `${session.orgId}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));

    const logoUrl = `/uploads/logos/${fileName}`;
    const db = getDb();
    await db.update(organizations).set({ logoUrl, updatedAt: Date.now() }).where(eq(organizations.id, session.orgId));

    return NextResponse.json({ logoUrl });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  await db.update(organizations).set({ logoUrl: null, updatedAt: Date.now() }).where(eq(organizations.id, session.orgId));
  return NextResponse.json({ success: true });
}
