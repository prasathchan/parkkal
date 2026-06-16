import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema";
import { storeFile, deleteFile } from "@/lib/storage";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

// SVG excluded: can contain embedded JS served as HTML by some browsers
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

/** POST /api/org/logo — upload a new org logo (ADMIN only) */
export const POST = withRoute(
  { route: "POST /api/org/logo", rateLimit: { limit: 20, windowMs: 60_000 }, adminOnly: true },
  async (req, { session, db, log }) => {
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file) return apiError("No file provided", 400);

    const allowedExt = ALLOWED_TYPES[file.type];
    if (!allowedExt) return apiError("Only JPEG, PNG, or WebP allowed", 400);
    if (file.size > MAX_SIZE) return apiError("File must be under 2 MB", 400);

    const [existing] = await db.select({ logoUrl: organizations.logoUrl }).from(organizations).where(eq(organizations.id, session.orgId));

    // Versioned key — a stable key would let CDN/browser caches keep serving the old
    // image at the same URL after a re-upload, since re-upload doesn't change the URL.
    const key = `logos/${session.orgId}/${Date.now()}${allowedExt}`;
    const bytes = await file.arrayBuffer();
    await storeFile(key, bytes, file.type);

    const logoUrl = `/api/files/${key}`;
    await db.update(organizations).set({ logoUrl, updatedAt: Date.now() }).where(eq(organizations.id, session.orgId));

    if (existing?.logoUrl) {
      const oldKey = existing.logoUrl.replace("/api/files/", "");
      await deleteFile(oldKey).catch(() => {}); // best-effort
    }

    log.info("Logo uploaded", { logoUrl });
    return apiOk({ logoUrl });
  }
);

/** DELETE /api/org/logo — remove the org logo (ADMIN only) */
export const DELETE = withRoute(
  { route: "DELETE /api/org/logo", rateLimit: RATE_LIMITS.DESTRUCTIVE, adminOnly: true },
  async (_req, { session, db, log }) => {
    const [org] = await db.select({ logoUrl: organizations.logoUrl }).from(organizations).where(eq(organizations.id, session.orgId));

    if (org?.logoUrl) {
      const key = org.logoUrl.replace("/api/files/", "");
      await deleteFile(key).catch(() => {}); // best-effort
    }

    await db.update(organizations).set({ logoUrl: null, updatedAt: Date.now() }).where(eq(organizations.id, session.orgId));
    log.info("Logo deleted");
    return apiOk({ success: true });
  }
);
