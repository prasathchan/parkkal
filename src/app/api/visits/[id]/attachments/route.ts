import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attachments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const rows = await db.select().from(attachments).where(eq(attachments.visitId, id));
  return NextResponse.json({ attachments: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const fileType = (formData.get("fileType") as string) || "OTHER";
  const patientId = formData.get("patientId") as string;

  if (!file || !patientId) {
    return NextResponse.json({ error: "file and patientId are required" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name) || "";
  const fileName = `${crypto.randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", patientId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);

  const fileUrl = `/uploads/${patientId}/${fileName}`;

  const db = getDb();
  const newAttachment = {
    id: crypto.randomUUID(),
    visitId: id,
    patientId,
    fileName,
    originalName: file.name,
    fileType: fileType as "XRAY" | "PRESCRIPTION" | "DOCTOR_NOTE" | "LAB_REPORT" | "OTHER",
    mimeType: file.type,
    fileSize: file.size,
    fileUrl,
    uploadedBy: session.userId,
    createdAt: Date.now(),
  };

  await db.insert(attachments).values(newAttachment);
  return NextResponse.json({ attachment: newAttachment }, { status: 201 });
}
