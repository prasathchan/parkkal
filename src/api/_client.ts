/**
 * api/_client.ts  (PRIVATE — don't import this directly)
 *
 * The base fetch wrapper used by all API modules.
 * Handles: JSON parsing, error messages, and TypeScript generics.
 *
 * WHY THIS EXISTS:
 *   Without this, every page does its own `fetch()` + `res.json()` + error handling.
 *   That means 60 places to update when something changes.
 *   With this, there is ONE place.
 */

/**
 * Thrown whenever the server returns a non-2xx response.
 * Has a `status` field so callers can check for 404 vs 500.
 *
 * Example:
 *   try { await api.patients.get(id) }
 *   catch (e) {
 *     if (e instanceof ApiError && e.status === 404) { ... }
 *   }
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Internal helper — call this instead of raw fetch() everywhere.
 *
 * @param path   API path, e.g. "/api/patients?limit=25"
 * @param init   Standard RequestInit (method, body, headers, etc.)
 * @returns      Parsed JSON response typed as T
 * @throws       ApiError if status is not 2xx
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  // Try to get a helpful message from the server's JSON body
  let errorMessage = `Request failed with status ${res.status}`;
  if (!res.ok) {
    try {
      const body = await res.json() as { error?: string };
      if (body.error) errorMessage = body.error;
    } catch {
      // Server didn't return JSON — use the default message
    }
    throw new ApiError(res.status, errorMessage);
  }

  return res.json() as Promise<T>;
}
