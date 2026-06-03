import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizations } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { storeFile, deleteFile } from "@/lib/storage";

// SVG excluded: can contain embedded JS served as HTML by some browsers
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const allowedExt = ALLOWED_TYPES[file.type];
    if (!allowedExt) {
      return NextResponse.json({ error: "Only JPEG, PNG, or WebP allowed" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 2 MB" }, { status: 400 });
    }

    const fileName = `${session.orgId}${allowedExt}`;
    const key = `logos/${fileName}`;
    const bytes = await file.arrayBuffer();
    await storeFile(key, bytes, file.type);

    // Logos are served via a public-facing URL for use in emails and print forms.
    // We store the /api/files key; the serve route handles auth for dashboard use.
    // For unauthenticated contexts (email, print) the org logo is served from R2 public URL
    // if available, otherwise falls back to the authenticated route.
    const logoUrl = `/api/files/${key}`;

    const db = getDb();
    await db
      .update(organizations)
      .set({ logoUrl, updatedAt: Date.now() })
      .where(eq(organizations.id, session.orgId));

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
  const [org] = await db
    .select({ logoUrl: organizations.logoUrl })
    .from(organizations)
    .where(eq(organizations.id, session.orgId));

  if (org?.logoUrl) {
    // Extract the storage key from the URL: /api/files/logos/<fileName> → logos/<fileName>
    const key = org.logoUrl.replace("/api/files/", "");
    await deleteFile(key).catch(() => {}); // best-effort
  }

  await db
    .update(organizations)
    .set({ logoUrl: null, updatedAt: Date.now() })
    .where(eq(organizations.id, session.orgId));

  return NextResponse.json({ success: true });
}
