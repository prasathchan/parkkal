/**
 * api/_client.ts  (PRIVATE — never import this directly in pages or components)
 *
 * The base fetch wrapper used by all API modules in src/api/.
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *
 *   apiFetch<T>(path, init?)
 *     → Makes an authenticated fetch to a relative API path.
 *     → Returns the parsed JSON response typed as T.
 *     → Throws ApiError (never raw Error) when the server returns non-2xx.
 *
 * ─── ERROR HANDLING PATTERN ──────────────────────────────────────────────────
 *
 *   All errors from the API are ApiError instances. Catch them like this:
 *
 *   try {
 *     const { patient } = await patientsApi.get(id);
 *   } catch (err) {
 *     if (err instanceof ApiError) {
 *       err.status   // HTTP status code: 400, 404, 409, 422, 500...
 *       err.message  // Human-readable message from the server
 *       err.details  // Array of Zod field errors (only on 400 responses)
 *                    // e.g. [{ path: ["phone"], message: "Invalid phone number" }]
 *       err.data     // Full raw response body (use for custom 409 fields like visitId)
 *     }
 *   }
 *
 * ─── FORMDATA UPLOADS ────────────────────────────────────────────────────────
 *
 *   For multipart file uploads, do NOT use apiFetch — it sets Content-Type: application/json
 *   which breaks multipart boundaries. Instead, call `fetch()` directly and throw ApiError
 *   on failure. See addAttachment() in api/visits.ts for the pattern.
 *
 * ─── NEVER IMPORT THIS FILE DIRECTLY ─────────────────────────────────────────
 *
 *   Always import from "@/api":
 *     import { patientsApi, ApiError } from "@/api";
 *
 *   Route handlers (api/routes) are server-only — they never use this file.
 */

// ─── Error class ─────────────────────────────────────────────────────────────

/**
 * Thrown by apiFetch() when the server returns a non-2xx response.
 *
 * @example
 *   catch (err) {
 *     if (err instanceof ApiError && err.status === 409) {
 *       router.push(`/dashboard/visits/${err.data?.visitId}`);
 *     }
 *   }
 */
export class ApiError extends Error {
  constructor(
    /** HTTP status code (e.g. 400, 404, 409, 422, 500) */
    public readonly status: number,
    /** Server-provided error message, or a fallback if the server returned no body */
    message: string,
    /**
     * Zod validation errors, present on 400 responses from routes using Zod.
     * Each entry identifies which field failed and why.
     * Use this for field-level form validation UI.
     */
    public readonly details?: Array<{ path: string[]; message: string }>,
    /**
     * Full parsed response body.
     * Use when the server attaches custom fields to error responses,
     * e.g. a 409 Conflict that includes the existing `visitId`.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public readonly data?: Record<string, any>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

/**
 * Internal base fetch — used by all api/* modules.
 *
 * Sets Content-Type: application/json automatically.
 * Parses the response as JSON.
 * Throws ApiError (never raw Error) on non-2xx responses.
 *
 * @param path  Relative API path, e.g. "/api/patients?limit=25"
 * @param init  Standard RequestInit — method, body, headers, etc.
 * @returns     Parsed JSON, typed as T
 * @throws      ApiError on any non-2xx response
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      // Content-Type: application/json is the default.
      // Callers can override by passing headers: { "Content-Type": "..." }.
      // For FormData uploads, don't use apiFetch at all — the browser must
      // set the Content-Type to include the multipart boundary.
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    // Parse the error body for a human-readable message and Zod field details.
    let errorMessage = `Request failed with status ${res.status}`;
    let errorDetails: Array<{ path: string[]; message: string }> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorData: Record<string, any> | undefined;

    try {
      const body = await res.json() as {
        error?: string;
        details?: Array<{ path: string[]; message: string }>;
        [key: string]: unknown;
      };
      if (body.error) errorMessage = body.error;
      if (body.details) errorDetails = body.details;
      errorData = body as Record<string, unknown>;
    } catch {
      // Server returned a non-JSON body (e.g. a Cloudflare error page).
      // The default message is good enough.
    }

    throw new ApiError(res.status, errorMessage, errorDetails, errorData);
  }

  return res.json() as Promise<T>;
}
