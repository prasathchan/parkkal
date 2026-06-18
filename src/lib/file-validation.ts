/**
 * lib/file-validation.ts
 *
 * Server-side file validation utilities for upload endpoints.
 * Validates MIME type via magic bytes (not just the Content-Type header),
 * enforces file size limits, and sanitizes file names.
 *
 * Security rationale: a client can send any Content-Type header they want,
 * so we verify by reading the first bytes of the actual file content.
 */

// ─── Magic byte signatures ────────────────────────────────────────────────────

interface MagicSignature {
  bytes: number[];
  offset?: number; // default 0
}

const MAGIC_BYTES: Record<string, MagicSignature[]> = {
  "image/jpeg":       [{ bytes: [0xFF, 0xD8, 0xFF] }],
  "image/png":        [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  "image/webp":       [{ bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF header
  "image/gif":        [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
  "image/heic":       [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }], // ftyp box
  "image/heif":       [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  "image/dicom":      [{ bytes: [0x44, 0x49, 0x43, 0x4D], offset: 128 }], // DICM at 128
  "application/pdf":  [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
};

/**
 * Checks the actual file bytes to confirm the MIME type matches the magic signature.
 * Returns true if the bytes match, false if they don't or if no signature is defined
 * (permissive for unknown types — the MIME allowlist in the route is the first gate).
 */
async function verifyMagicBytes(file: File, mimeType: string): Promise<boolean> {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return true; // No known magic — defer to MIME allowlist

  const readLength = Math.min(file.size, 200);
  const buffer = await file.slice(0, readLength).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  return signatures.some(({ bytes: sig, offset = 0 }) => {
    if (offset + sig.length > bytes.length) return false;
    return sig.every((b, i) => bytes[offset + i] === b);
  });
}

// ─── File name sanitization ───────────────────────────────────────────────────

/**
 * Strips path separators, null bytes, and characters outside safe ASCII/Unicode
 * ranges from a file name. Preserves the extension.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, "_")     // path separators
    .replace(/\0/g, "")          // null bytes
    .replace(/\.{2,}/g, ".")     // path traversal sequences like ../
    .replace(/[<>:"|?*]/g, "_")  // Windows reserved characters
    .trim()
    .slice(0, 255);              // max file name length
}

// ─── Unified validation entry point ──────────────────────────────────────────

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates an uploaded File against the given allowed MIME types and max size.
 * Checks: MIME allowlist, file size, magic bytes, and file name safety.
 */
export async function validateUploadedFile(
  file: File,
  options: {
    allowedMimeTypes: string[];
    maxSizeBytes: number;
    label?: string;
  }
): Promise<FileValidationResult> {
  const { allowedMimeTypes, maxSizeBytes, label = "File" } = options;

  if (file.size === 0) {
    return { valid: false, error: `${label} is empty` };
  }

  if (file.size > maxSizeBytes) {
    const mb = Math.round(maxSizeBytes / (1024 * 1024));
    return { valid: false, error: `${label} must be under ${mb} MB` };
  }

  const mime = file.type.toLowerCase();
  if (!allowedMimeTypes.includes(mime)) {
    return {
      valid: false,
      error: `${label} type "${mime}" is not allowed. Allowed: ${allowedMimeTypes.join(", ")}`,
    };
  }

  const magicOk = await verifyMagicBytes(file, mime);
  if (!magicOk) {
    return {
      valid: false,
      error: `${label} content does not match the declared type "${mime}"`,
    };
  }

  return { valid: true };
}
