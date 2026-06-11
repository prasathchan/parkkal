// TypeScript 5.5+ returns Promise<unknown> from Response.json().
// All callers in this codebase either:
//   (a) cast immediately via `as T` (apiFetch in api/_client.ts), or
//   (b) pass the result to Zod .parse() / .safeParse() (route handlers).
// No override needed — unknown is the correct and safe type here.
