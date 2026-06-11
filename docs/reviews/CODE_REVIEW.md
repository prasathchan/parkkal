# Parkkal — Code Review & Architecture Review

**Reviewed by:** Cowork Agent  
**Date:** June 2026  
**Scope:** Full codebase — architecture, security, API routes, client layer, tests

---

## Verdict Summary

| Area | Rating | Notes |
|---|---|---|
| Core Architecture | ⭐⭐⭐⭐⭐ | `withRoute()` is excellent |
| Security | ⭐⭐⭐⭐ | Solid fundamentals; two gaps to address |
| Multi-Tenancy | ⭐⭐⭐⭐⭐ | Consistently enforced |
| API Routes | ⭐⭐⭐⭐ | Two routes bypass `withRoute()` |
| Client Layer | ⭐⭐⭐ | One page heavily violates Rule 1 |
| Test Coverage | ⭐⭐⭐⭐ | Strong for a solo project; some routes untested |
| Constants Discipline | ⭐⭐⭐ | Magic strings leak into several routes |

---

## Part 1 — Architecture Review

### What's Working Very Well

**`withRoute()` Higher-Order Function**  
The best architectural decision in this codebase. The middleware pipeline — body-size guard → auth → token revocation → member-active check → rate limit → permission check → business logic → error handling — is correct, exhaustive, and applied consistently. The comment block explaining the "before" (600 lines of boilerplate) and "after" is excellent documentation.

**JWT Design**  
Audience separation (`pkd:pre-org` vs `pkd:org`) is the right call — it prevents a pre-login token from being accepted on a protected endpoint. Permissions embedded in the JWT payload avoid a DB round-trip on every request, with a clean fallback to DB lookup for legacy tokens.

**Token Revocation**  
D1-backed `revoked_tokens` table with `jti` per session is correctly implemented. Logout writes the jti, `withRoute()` checks it before business logic. Fails open on D1 unavailability — documented trade-off, acceptable.

**Multi-Tenancy Enforcement**  
Every sensitive query includes `eq(table.organizationId, session.orgId)`. The `organizationPatients` join on patient fetch/update is an extra layer of isolation (even if the patient ID leaks, the org check blocks access). This is correctly applied across all reviewed routes.

**Rate Limiting**  
D1-backed with an atomic `UPSERT + conditional UPDATE` pattern — this correctly avoids the read-then-write race condition that most in-memory rate limiters have. The `RATE_LIMITS` presets are well-calibrated.

**Encryption**  
AES-256-GCM for PAN/Aadhaar with per-value IVs, cached `CryptoKey`, and `enc:` prefix for transparent legacy passthrough. Correct implementation. Key-missing warning in production (not an error-throw) is intentional for local dev.

**Security Headers**  
CSP, HSTS (production-only), COOP, CORP, `X-Content-Type-Options`, `Permissions-Policy` — all set in middleware on every response. The decision to skip `COEP: require-corp` due to R2 signed URL compatibility is documented and correct.

**OTP Hashing**  
bcrypt cost 10 for OTPs (not plaintext storage) is the right call. The lookup pattern — fetch by `(userId, type)`, then `bcrypt.compare` — is correctly documented.

**`runCascade()`**  
Atomic multi-table deletes using Drizzle batch API. Used correctly in the patient delete route.

---

## Part 2 — Bugs and Issues

### 🔴 Critical

**None found.**

---

### 🟠 High Priority

**1. Raw `fetch()` in `patients/[id]/page.tsx` — Rule 1 Violation**

File: `src/app/dashboard/patients/[id]/page.tsx`

The entire page is built on 8+ raw `fetch()` calls, bypassing the typed `@/api` layer entirely. Errors are silently swallowed (`.catch(() => {})`) and response types are untyped (`unknown[]`). This page would not catch a 403, a network failure, or an API shape change at compile time.

```typescript
// ❌ Current — raw fetch, untyped, errors swallowed
fetch(`/api/patients/${id}`)
  .then((r) => r.json())
  .then((d) => setPatient(d.patient))
  .finally(() => setLoading(false));

// ✅ Should be
const { data, loading, error } = useAsync(
  () => patientsApi.get(id),
  [id]
);
```

Affected calls: patient detail, balance, emergency contacts, visits/appointments/treatments/invoices tabs, tooth-chart GET and PUT.

**2. `GET /api/patients/[id]/tooth-chart` route does not exist**

File: `src/app/dashboard/patients/[id]/page.tsx` lines 79, 119

The page makes GET and PUT calls to `/api/patients/${id}/tooth-chart` but no such route exists anywhere in `src/app/api/`. This is a broken feature — the tooth chart tab silently loads nothing and save is a no-op.

**3. Schema Duplication — `src/lib/schemas/visit.ts` is unused**

`src/lib/schemas/visit.ts` defines `createVisitSchema`, `updateVisitSchema`, `createPaymentSchema` etc. using `@/constants` (correct pattern). However the actual route handlers in `src/app/api/visits/` define their own local Zod schemas and do NOT import from `src/lib/schemas/`.

Worse — the two `createVisitSchema` definitions have conflicting `visitType` values:
- `src/lib/schemas/visit.ts`: `z.enum(["WALK_IN", "APPOINTMENT"])`
- `src/app/api/visits/route.ts`: `z.enum(["APPOINTMENT", "WALKIN"])` (no underscore)

The shared schemas library is infrastructure debt that isn't delivering its intended benefit.

---

### 🟡 Medium Priority

**4. Magic Strings in API Routes — Rule 3 Violations**

`@/constants` has `VISIT_STATUS`, `TREATMENT_STATUS`, `PAYMENT_METHOD` — but several routes use raw string literals instead:

| File | Raw string | Should be |
|---|---|---|
| `patients/[id]/balance/route.ts` | `"OPEN"` | `VISIT_STATUS.OPEN` |
| `recalls/route.ts` | `"COMPLETED"`, `"CANCELLED"` | `VISIT_STATUS.*` |
| `appointments/[id]/route.ts` | `"SCHEDULED"`, `"CANCELLED"`, `"NO_SHOW"` | `APPOINTMENT_STATUS.*` (not yet in constants) |
| `visits/route.ts` | `"OPEN"`, `"COMPLETED"`, `"CANCELLED"` in cast | `VISIT_STATUS.*` |

The `constants/visit.ts` file exists — it just isn't being imported in these routes.

**5. Calendar Routes Bypass `withRoute()`**

Files: `src/app/api/calendar/google/route.ts`, `calendar/outlook/route.ts`, `calendar/google/callback/route.ts`, `calendar/outlook/callback/route.ts`, `calendar/disconnect/route.ts`, `calendar/status/route.ts`

These all use manual `getSession()` checks without going through `withRoute()`. They miss:
- Member-active check (deactivated staff can still manage calendar)
- Token revocation check (revoked tokens accepted)
- Rate limiting (calendar OAuth can be triggered unlimitedly)
- Structured error logging to `app_logs`

Fix: wrap with `withRoute({ route: "...", permission: PERMISSIONS.ORG_SETTINGS })`.

**6. Raw `fetch()` in `settings/calendar/page.tsx`**

File: `src/app/dashboard/settings/calendar/page.tsx`

Two raw `fetch()` calls — one for status, one for disconnect. Minor relative to the patients page issue but same Rule 1 violation.

**7. Missing `Retry-After` Headers in `withRoute()` 429 Responses**

The login route correctly sends `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on 429. But `withRoute()`'s built-in 429 path returns none of these, making it impossible for a client to implement exponential backoff correctly.

**8. Cron Route Has No Authentication**

File: `src/app/api/cron/reminders/route.ts`

The reminder cron endpoint is unauthenticated. On Cloudflare, cron jobs are triggered by Cloudflare's scheduler (not HTTP), so this may be acceptable — but if the route is ever callable via HTTP (e.g. during testing or if the matcher config changes), anyone can trigger reminder dispatch. Should check for a `CF-Scheduled` header or a secret `Authorization` token.

---

### 🔵 Low Priority / Improvements

**9. `bloodGroup` Zod Enum Incomplete in POST /api/patients**

File: `src/app/api/patients/route.ts` line 32

The PRD specifies the full list including `A1`, `A2`, `A1B`, `A2B`, `Bombay Oh`. The Zod schema only validates 8 standard types. The `BloodGroupSelect` UI component likely has the full list, but the API rejects rare blood groups.

**10. `withRoute()` member-active check skips ADMIN role**

File: `src/lib/api.ts` line 307

The check `if (session.role !== "ADMIN")` skips the active-member DB check for admins. This means a deactivated admin can still act on the org until their token expires. Consider whether this is the right trade-off (it currently is the last-admin safety net), but document it explicitly.

**11. Calendar OAuth State Not Signed**

File: `src/app/api/calendar/google/route.ts`

```typescript
const state = Buffer.from(JSON.stringify({ userId, orgId })).toString("base64url");
```

The OAuth `state` param is just base64-encoded JSON — not signed. A malicious actor who can intercept or forge the callback request could supply an arbitrary `userId`/`orgId`. Should be signed with `JWT_SECRET` or replaced with a short-lived token stored in D1.

**12. `patients/route.ts` POST — Patient Code Race Condition Retry Uses Global Count**

The retry loop increments `totalCount + 1 + attempt` to generate `PKL-XXXXXX`, but `totalCount` counts the global `patients` table. If two orgs create patients simultaneously, they get non-sequential codes. Not wrong, but documented for awareness. The org-scoped code (`PKD-0001`) correctly uses `orgCount`.

---

## Part 3 — Test Coverage Assessment

**Total test files:** 22  
**Total test lines:** ~3,400  
**Verdict:** Solid, especially for lib utilities. Route tests exist but have gaps.

### Well-Covered

- `lib/encryption` — encrypt/decrypt roundtrip, missing key behaviour
- `lib/auth-edge` — JWT create/verify, audience isolation, expiry
- `lib/auth-revocation` — revokeToken, isTokenRevoked
- `lib/permissions` — ADMIN bypass, custom role, coarse fallback
- `lib/rate-limit` — memory and D1 paths
- `lib/billing` — status computation
- `lib/audit` — writeAuditLog
- Route tests for: auth/login, auth/logout, patients, visits, payments, appointments, treatments, org-roles

### Missing Test Coverage

| Area | Risk if Untested |
|---|---|
| `recalls/route.ts` | Recall status computation logic (`computeRecallStatus()`) |
| `reports/route.ts` | Revenue calculation correctness |
| `invoices/route.ts` | Status transitions, paid amount computation |
| Calendar routes | OAuth flow, token storage |
| `lib/schemas/` | Shared schemas are written but never imported by routes |
| `lib/otp.ts` | No dedicated test for `hashOTP`/`verifyOTP` |
| `withRoute()` member-active check | Token revocation path inside `withRoute()` |

---

## Part 4 — Positive Highlights (Do Not Change)

These patterns are genuinely well-done and should be preserved in Phase 2 development:

- `withRoute()` middleware chain — keep adding all new routes through it
- `organizationId` in every write and read query — non-negotiable
- Permissions in JWT payload — avoid reverting to DB-per-request
- `runCascade()` for atomic deletes — don't replace with sequential awaits
- `escapeLike()` before LIKE queries — prevents LIKE injection
- Sensitive fields excluded from list endpoints (medicalHistory, PAN, Aadhaar)
- RBAC: Doctor role sees only their own visits — extend this to appointments
- Audit log on compliance-critical consent actions

---

## Part 5 — Priority Action List

| # | Issue | File | Priority |
|---|---|---|---|
| 1 | Refactor `patients/[id]/page.tsx` to use `useAsync` + `@/api` | `dashboard/patients/[id]/page.tsx` | 🟠 High |
| 2 | Create `GET /PUT /api/patients/[id]/tooth-chart` route | `app/api/patients/[id]/tooth-chart/route.ts` | 🟠 High |
| 3 | Add `withRoute()` to all 6 calendar routes | `app/api/calendar/*/route.ts` | 🟠 High |
| 4 | Replace magic strings with `VISIT_STATUS.*` constants | `recalls`, `balance`, `visits`, `appointments` routes | 🟡 Medium |
| 5 | Unify or delete `src/lib/schemas/visit.ts` | `lib/schemas/visit.ts` | 🟡 Medium |
| 6 | Add `Retry-After` header to `withRoute()` 429 path | `lib/api.ts` | 🟡 Medium |
| 7 | Sign calendar OAuth state param | `app/api/calendar/google/route.ts` | 🟡 Medium |
| 8 | Add cron authentication guard | `app/api/cron/reminders/route.ts` | 🟡 Medium |
| 9 | Fix `bloodGroup` enum in patient POST schema | `app/api/patients/route.ts` | 🔵 Low |
| 10 | Refactor `settings/calendar/page.tsx` to use `@/api` | `dashboard/settings/calendar/page.tsx` | 🔵 Low |

---

*This review was generated from a full read of the codebase. No automated lint or runtime execution was performed.*
