// Storage abstraction — Cloudflare R2 in production, local filesystem in dev.
// All routes import from here; never call fs or R2 directly.

import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import path from "path";

export interface StoredFile {
  key: string;       // storage key (used to retrieve / delete)
  url: string;       // URL to serve the file (authenticated API route)
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

async function getR2(): Promise<R2Bucket | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    return (ctx?.env?.FILES as R2Bucket) ?? null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Store a file. Returns the key and the authenticated serving URL.
 * key format: "<folder>/<uuid><ext>"  e.g. "patients/abc123/def456.jpg"
 */
export async function storeFile(
  key: string,
  data: ArrayBuffer,
  mimeType: string
): Promise<StoredFile> {
  const r2 = await getR2();

  if (r2) {
    await r2.put(key, data, { httpMetadata: { contentType: mimeType } });
  } else {
    // Local dev fallback — write to private_uploads/
    const localPath = path.join(process.cwd(), "private_uploads", key);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, Buffer.from(data));
  }

  // The serving URL is always the authenticated API route; clients never hit R2 directly.
  const url = `/api/files/${key}`;
  return { key, url };
}

/**
 * Retrieve a file's raw bytes and MIME type.
 */
export async function getFile(
  key: string
): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
  const r2 = await getR2();

  if (r2) {
    const obj = await r2.get(key);
    if (!obj) return null;
    return {
      data: await obj.arrayBuffer(),
      mimeType: obj.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }

  // Local dev fallback
  try {
    const localPath = path.join(process.cwd(), "private_uploads", key);
    const data = await readFile(localPath);
    const ext = path.extname(key).toLowerCase();
    const MIME: Record<string, string> = {
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
      ".dcm": "application/dicom",
    };
    return { data: data.buffer as ArrayBuffer, mimeType: MIME[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
  const r2 = await getR2();
  if (r2) {
    await r2.delete(key);
  } else {
    try {
      await unlink(path.join(process.cwd(), "private_uploads", key));
    } catch {
      // File may already be gone — ignore
    }
  }
}
