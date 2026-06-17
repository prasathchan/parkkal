# Architecture Guide

> **Start here** if you're new to this codebase.
> This document explains the "why" behind every structural decision.

---

## The data flow (request lifecycle)

```
Browser
  │
  ▼
Next.js App Router  (app/dashboard/*)
  │  uses
  ▼
Typed API Client    (src/api/*.ts)
  │  calls
  ▼
REST API Routes     (src/app/api/*)
  │  protected by
  ▼
withRoute() HOF     (src/lib/api.ts)
  │  which runs:
  ├─ 1. Auth check       → getSession()        (src/lib/auth.ts)
  ├─ 2. Token revocation → isTokenRevoked()    (D1 revoked_tokens table)
  ├─ 3. Member active    → organizationMembers (D1 query)
  ├─ 4. Rate limit       → checkRateLimit()    (src/lib/rate-limit.ts)
  ├─ 5. Permission check → hasPermission()     (src/lib/permissions.ts)
  └─ 6. Your handler     → business logic
          │
          ▼
       Drizzle ORM      (src/db/schema.ts)
          │
          ▼
       Cloudflare D1    (SQLite at the edge)
```

---

## Why Cloudflare Workers + D1?

A dental clinic has unpredictable traffic — busy in the morning, idle at night.
Traditional servers cost money 24/7. Cloudflare Workers:

- Scale to zero (₹0 when idle)
- Scale instantly (burst to thousands of requests)
- D1 is co-located at the edge — near-zero DB latency
- One-command deployment worldwide

**The tradeoff:** D1 is SQLite, not PostgreSQL. No `ALTER COLUMN`. Migrations are
forward-only. This is acceptable for a clinic-scale app.

---

## Multi-tenancy: how one deployment serves many clinics

Every sensitive table has `organization_id`. The session JWT carries `orgId`.

`withRoute()` gives every handler a `session` object. You filter by `session.orgId`:

```typescript
// This is the pattern — every data query includes orgId
const [patient] = await db
  .select()
  .from(patients)
  .where(and(
    eq(patients.id, id),
    eq(patients.organizationId, session.orgId),  // ← critical
  ));

if (!patient) return apiError("Not found", 404);
// If another clinic's ID was passed, the patient just "doesn't exist" — no 403 leak
```

---

## Multi-branch: how one organisation runs multiple clinics

> **Status: designed, not yet implemented.**
> Full implementation spec: `product/specs/MULTI_BRANCH.md`

A single `Organization` can have multiple physical **branches** (locations). The
architecture uses a two-level isolation model — the most important concept to understand
before touching any branch-related code:

```
Org isolation  = HARD WALL   — WHERE organization_id = ?  on every query, always
Branch filter  = SOFT LENS   — WHERE branch_id = ?  applied only where relevant
```

**Branch is not a data partition.** It is a view filter. The same patient record
is visible to all branches within the org. A visit record carries a `branch_id` to
record *where it happened* — not to restrict who can see it.

### The three data layers

| Layer | Filter applied | Examples |
|-------|---------------|---------|
| Global | none | `patients`, `users` |
| Org | `organization_id = ?` | `treatments`, `org_roles`, `org_drugs` |
| Branch | `organization_id = ?` AND optionally `branch_id = ?` | `visits`, `appointments`, `invoices` |

The branch filter is optional because org admins (`branchAccess: 'all'`) see all
branches. Branch staff see only their assigned branches.

### New tables

- **`branches`** — the physical location (`id`, `organizationId`, `name`, `code`,
  `isHeadquarters`, `timezone`, `settings`)
- **`branch_members`** — staff-to-branch assignment many-to-many
  (`branchId`, `userId`, `organizationId`, `orgRoleId`, `isPrimary`)

### Modified tables (add `branch_id`)

`visits`, `appointments`, `invoices`, `salary_records`,
`organization_patients` (as `registered_branch_id`)

### Session changes

JWT gains `branchAccess: 'all' | string[]` and `primaryBranchId`.
The *active* branch is **not** in the JWT — it flows as an `X-Branch-Id` request
header so staff can switch branches without re-logging in.

### withRoute() gains two new flags

```typescript
branchAware: true   // reads + validates X-Branch-Id, injects branchFilter
crossBranch: true   // skips branch filter — org admin reports only
```

See `product/specs/MULTI_BRANCH.md` for the complete SQL, migration plan,
permission additions, query patterns, and implementation checklist.

---

## Permissions: two-level model

Staff have a **coarse role** (`ADMIN`, `DOCTOR`, `NURSE`, etc.) AND optionally a
**custom org role** (`orgRoleId`) with a fine-grained permission list.

```
User logs in
    ↓
JWT is minted with permissions[] array
    ↓
Every API request reads permissions from JWT (no DB round-trip)
    ↓
withRoute({ permission: PERMISSIONS.VISITS_CREATE }) checks the array
```

The permission list is resolved once at login:
1. If `orgRoleId` is set → use that role's `permissions` JSON column
2. Otherwise → use the hardcoded defaults for the coarse role (see `default-roles.ts`)

**To add a permission:** `permissions.ts` → `default-roles.ts` → `withRoute()`

---

## The `withRoute()` contract

Every API handler receives exactly these arguments:

```typescript
async (request, { session, db, log }, params) => {
  // session  — who is calling (userId, orgId, role, permissions[])
  // db       — Drizzle DB instance, scoped to this request
  // log      — structured logger pre-tagged with this route + session
  // params   — path params (e.g. { id: "abc" } for /api/patients/[id])

  return apiOk({ ... });    // 200 JSON response
  return apiError("...", 404); // error JSON response
}
```

If your handler throws a `ZodError`, `withRoute()` catches it and returns 400 with
field-level details. Any other error becomes 500 and is persisted to `appLogs` in D1.

---

## Why typed API client modules (`src/api/`)?

Pages used to call `fetch()` directly. Problems:
- No TypeScript types on responses
- 30+ places to update if a URL changes
- Error handling duplicated everywhere
- No consistent loading / error pattern

Now pages import from `@/api`:
```typescript
const { patients } = await patientsApi.list({ search });
```

Each `src/api/*.ts` file maps 1:1 to a backend resource. The barrel `src/api/index.ts`
is the only import path pages should use.

---

## State management: no Redux, no Zustand

State is deliberately local. Most pages own their own state with `useState`. Cross-page
state (e.g. "who am I logged in as") is in the session cookie — read via `authApi.me()`.

The `useAsync()` hook handles the universal "fetch → loading → data / error" pattern.
The `useDebounce()` hook handles search inputs.

This is enough for a clinic app. If it grows to need shared state, add Zustand then —
don't add it speculatively.

---

## Constants: the single source of truth for magic strings

```
src/constants/
├── visit.ts      ← VISIT_STATUS, ITEM_CATEGORY, PAYMENT_METHOD, BILLING_STATUS
├── treatment.ts  ← TREATMENT_STATUS, CONSENT_STATUS
├── ui.ts         ← shared UI labels and colours
└── index.ts      ← barrel
```

Rule: if the same string appears in more than one file, it belongs in constants.
Rule: if a string is used in business logic (not just display), it belongs in constants.

---

## Validation: Zod everywhere

- **API routes:** Zod schema for every request body. `withRoute()` catches `ZodError` → 400.
- **Client:** `ApiError.details` carries the Zod field errors for field-level UI feedback.
- **Environment:** `src/lib/env.ts` validates all env vars at startup.
- **Shared schemas:** `src/lib/schemas/` for schemas used in multiple routes.

Never use raw `typeof` or `if (!body.field)` checks in routes.

---

## File naming conventions

| Pattern | Meaning |
|---------|---------|
| `route.ts` | Next.js API route handler (server only) |
| `page.tsx` | Next.js page component (can be client or server) |
| `*.ts` (in `src/api/`) | Typed client API module |
| `*.ts` (in `src/lib/`) | Server-side utility (never import in `"use client"` files) |
| `*.ts` (in `src/types/`) | TypeScript interface definitions only |
| `*.ts` (in `src/constants/`) | `as const` enums and labels |
| `use-*.ts` (in `src/hooks/`) | React hooks |

---

## Scalability design decisions

### What scales automatically

- **Workers runtime** — stateless, runs at the edge. Adding more traffic = Cloudflare
  handles it. No configuration needed.
- **D1 database** — SQLite is extremely fast for read-heavy workloads. Read replication
  is available if needed.
- **Rate limiting** — backed by D1, not in-memory. Works correctly across all Worker
  instances (unlike Map-based rate limiters).

### What needs work before high scale

| Gap | Solution when needed |
|-----|---------------------|
| No background jobs | Add Cloudflare Queues for async tasks (reminders, reports) |
| No caching layer | Add Cloudflare KV for session data and hot reads |
| No full-text search | Add Cloudflare Vectorize or an external search index |
| Single D1 per org | Shard by org at the Workers routing layer |

### Database indexing strategy

All indexes are in `drizzle/migrations/0009_indexes_rate_limits.sql` and `0020_indexes.sql`.
Every foreign key column that appears in a WHERE clause has an index. Composite indexes
exist for the most common multi-column filters (e.g. `(organization_id, visit_date)`).

Before adding a new frequently-filtered column, add its migration with an index.

---

## Adding a new domain (e.g. "lab orders")

Here is the full checklist, in order:

1. `src/db/schema.ts` — add the table with `organizationId`
2. `drizzle/migrations/NNNN_lab_orders.sql` — write the migration
3. `src/lib/permissions.ts` — add `LAB_ORDERS_VIEW`, `LAB_ORDERS_CREATE`, etc.
4. `src/lib/default-roles.ts` — assign permissions to roles
5. `src/lib/schemas/lab-order.ts` — Zod schemas for request validation
6. `src/types/lab-order.ts` — TypeScript interfaces
7. `src/types/index.ts` — re-export them
8. `src/app/api/lab-orders/route.ts` — GET + POST using `withRoute()`
9. `src/app/api/lab-orders/[id]/route.ts` — GET + PATCH + DELETE
10. `src/api/lab-orders.ts` — typed client functions
11. `src/api/index.ts` — export `labOrdersApi`
12. `src/app/dashboard/lab-orders/page.tsx` — list page
13. `src/components/sidebar.tsx` — add nav link

That's the entire chain. No step can be skipped without causing a type error or a runtime error.
