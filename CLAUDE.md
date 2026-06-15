# CLAUDE.md — Developer Handbook

> This file is read by Claude Code (claude.ai/code) AND by every human developer
> joining the project. It is the single source of truth for "how does this codebase work."

---

## Quick orientation (read this first)

**Parkkal** is a multi-tenant SaaS for dental clinics. One organisation = one clinic.
Staff log in, manage patients, record visits, track treatment plans, and handle billing.

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 — App Router |
| Deployment | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite at the edge) |
| ORM | Drizzle ORM |
| Email | Resend |
| SMS | Twilio |
| File storage | Cloudflare R2 (via `storage.ts`) |
| Styling | Tailwind CSS |
| Validation | Zod (everywhere — never raw `typeof` checks) |
| Testing | Vitest |

---

## Commands

```bash
# Install dependencies
npm install

# Development server (localhost:3000)
npm run dev

# Type-check without building
npx tsc --noEmit

# Run tests
npm test
npm run test:watch      # watch mode
npm run test:coverage   # coverage report

# Lint
npm run lint

# Production build (validates everything)
npm run build

# Local DB setup (run once, or after adding a migration)
node scripts/setup-local-db.js

# Apply a single migration locally
npx wrangler d1 execute parkkal-db --local \
  --file=drizzle/migrations/NNNN_your_migration.sql
```

---

## How to find any piece of code

```
src/
├── api/             ← CLIENT-SIDE typed API functions (what pages call)
│   ├── _client.ts   ← base apiFetch() + ApiError class
│   ├── patients.ts  ← everything to do with patients
│   ├── visits.ts    ← visits + items + payments + prescriptions + attachments
│   ├── treatments.ts ← treatment plans + consent
│   ├── appointments.ts
│   ├── org.ts       ← organisation profile + members + roles + salary
│   ├── auth.ts      ← login / logout / me / change-password
│   ├── invoices.ts
│   ├── admin.ts     ← audit log + app logs (admin only)
│   └── index.ts     ← barrel — always import from "@/api", never "@/api/patients"
│
├── app/
│   ├── api/         ← SERVER-SIDE route handlers (the actual REST API)
│   │   ├── auth/    ← login, logout, signup, OTP flows
│   │   ├── patients/
│   │   ├── visits/[id]/  ← and sub-routes: /items, /payments, /attachments...
│   │   ├── treatments/
│   │   ├── appointments/
│   │   ├── org/     ← profile, members, roles, salary
│   │   ├── admin/   ← audit-log, app-logs
│   │   └── ...
│   │
│   └── dashboard/   ← UI pages (what the user sees)
│       ├── page.tsx            ← dashboard home / stats
│       ├── patients/           ← patient list, new patient, edit patient
│       ├── visits/             ← visit list, new visit, visit detail
│       ├── treatments/         ← treatment plan list, detail
│       ├── appointments/       ← appointment list, new appointment
│       ├── billing/            ← billing queue
│       ├── staff/              ← staff list, staff detail
│       ├── roles/              ← custom role management
│       ├── salary/             ← salary records
│       ├── invoices/           ← invoice list
│       ├── recalls/            ← recall visit list
│       ├── reports/            ← analytics
│       └── settings/           ← org settings, audit log, app logs
│
├── components/
│   ├── ui/          ← generic reusable components (Button, Modal, Skeleton, etc.)
│   ├── visits/      ← tabs shown inside a visit detail page
│   ├── treatments/  ← modals used on the treatments page
│   ├── sidebar.tsx
│   └── header.tsx
│
├── constants/       ← magic strings as typed constants (NEVER use raw strings in logic)
│   ├── visit.ts     ← VISIT_STATUS, ITEM_CATEGORY, PAYMENT_METHOD, BILLING_STATUS
│   ├── treatment.ts ← TREATMENT_STATUS, CONSENT_STATUS
│   ├── ui.ts        ← shared UI constants (colours, labels)
│   └── index.ts     ← barrel — import from "@/constants"
│
├── db/
│   ├── schema.ts    ← EVERY table and column defined here (Drizzle schema)
│   └── relations.ts ← Drizzle relation definitions
│
├── hooks/
│   ├── use-async.ts    ← universal data-fetching hook (loading/error/data)
│   └── use-debounce.ts ← delays a value (used for search inputs)
│
├── lib/             ← server-side utilities (never import in client components)
│   ├── api.ts       ← withRoute() HOF — wraps every API route handler
│   ├── auth.ts      ← JWT create/verify, password hash/verify
│   ├── db.ts        ← getDb() + runCascade() for atomic multi-table deletes
│   ├── permissions.ts ← PERMISSIONS constants + hasPermission()
│   ├── rate-limit.ts  ← D1-backed rate limiter
│   ├── email.ts     ← Resend email sending
│   ├── sms.ts       ← Twilio SMS sending
│   ├── storage.ts   ← R2 file upload/delete
│   ├── encryption.ts ← AES-256-GCM encrypt/decrypt for PII fields
│   ├── otp.ts       ← secure OTP generation and hashing
│   ├── logger.ts    ← structured server logger (JSON in prod, readable in dev)
│   ├── app-logger.ts ← persists errors/security events to D1 for admin viewer
│   ├── audit.ts     ← writeAuditLog() for compliance-critical actions
│   ├── billing.ts   ← billing status computation helpers
│   ├── env.ts       ← validated env vars (import this, never process.env directly)
│   └── schemas/     ← shared Zod validation schemas used across multiple routes
│       ├── patient.ts
│       ├── visit.ts
│       └── common.ts
│
└── types/           ← TypeScript interfaces for every domain entity
    ├── patient.ts
    ├── visit.ts
    ├── treatment.ts
    ├── staff.ts
    ├── appointment.ts
    ├── invoice.ts
    ├── recall.ts
    ├── report.ts
    ├── org.ts
    ├── auth.ts
    └── index.ts     ← barrel — import from "@/types"
```

---

## The three rules every developer must know

### Rule 1 — Pages never call `fetch()` directly

Every page imports from `@/api`, never calls `fetch()` raw.

```typescript
// ✅ CORRECT
import { patientsApi, ApiError } from "@/api";
const { patients } = await patientsApi.list({ search });

// ❌ WRONG — raw fetch
const res = await fetch("/api/patients?search=" + search);
```

Why: type safety, consistent error handling, single place to change if the API changes.

### Rule 2 — Every API route goes through `withRoute()`

Never write a route handler manually. Always use `withRoute()` from `@/lib/api`.

```typescript
// ✅ CORRECT
export const GET = withRoute(
  { route: "GET /api/patients", permission: PERMISSIONS.PATIENTS_VIEW },
  async (req, { session, db }) => {
    return apiOk({ patients: [...] });
  }
);

// ❌ WRONG — manual session check, manual error handling
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ...
}
```

Why: auth, rate limiting, permission check, Zod error handling, app logging — all in one place.

### Rule 3 — Magic strings live in `@/constants`, nowhere else

```typescript
// ✅ CORRECT
import { VISIT_STATUS } from "@/constants";
if (visit.status === VISIT_STATUS.COMPLETED) { ... }

// ❌ WRONG
if (visit.status === "COMPLETED") { ... }
```

Why: typos cause silent bugs. Constants give you autocomplete and compiler errors.

---

## How to add a new feature (step-by-step)

### Adding a new API endpoint

1. **Create the route file** at the right path under `src/app/api/`
2. **Add Zod schema** for the request body in `src/lib/schemas/` (if validation needed)
3. **Write the handler** using `withRoute()` — pick the right `permission` from `PERMISSIONS`
4. **Add the client function** in the right file under `src/api/`
5. **Export it** from `src/api/index.ts` if it's a new module
6. **Add types** to the right file under `src/types/` if new shapes are introduced

**Example — adding `GET /api/recalls/[id]`:**

```
src/app/api/recalls/[id]/route.ts   ← new route handler
src/api/recalls.ts                  ← add getRecall(id) function
src/types/recall.ts                 ← add RecallDetail interface if needed
```

### Adding a new dashboard page

1. Create `src/app/dashboard/your-feature/page.tsx`
2. Mark it `"use client"` if it has interactivity
3. Use `useAsync()` hook for data fetching
4. Import from `@/api` — never raw fetch
5. Add the nav link to `src/components/sidebar.tsx`

### Adding a new database column

1. **Add to schema** `src/db/schema.ts`
2. **Write migration** `drizzle/migrations/NNNN_description.sql`
3. **Apply locally** `node scripts/setup-local-db.js`
4. **Update the TypeScript type** in `src/types/`
5. **Update the API route** that reads/writes this table
6. **Update the typed client** in `src/api/`

### Adding a new permission

1. Add the constant to `PERMISSIONS` in `src/lib/permissions.ts`
2. Add it to the relevant roles in `src/lib/default-roles.ts`
3. Use `permission: PERMISSIONS.YOUR_PERMISSION` in `withRoute()`

---

## Key architectural patterns

### Multi-tenancy

Every sensitive DB table has an `organizationId` column. Every query **must** include
`eq(table.organizationId, session.orgId)` in its WHERE clause. Forgetting this leaks
data between clinics.

### Error handling on the client

All `@/api` functions throw `ApiError` on non-2xx responses.

```typescript
try {
  await patientsApi.create(payload);
} catch (err) {
  if (err instanceof ApiError) {
    console.log(err.status);   // 422
    console.log(err.message);  // "Phone number already exists"
    console.log(err.details);  // Zod field errors: [{ path: ["phone"], message: "..." }]
  }
}
```

### Atomic multi-table deletes

Use `runCascade()` — never `await` delete statements independently.

```typescript
await runCascade(db, [
  db.delete(visitItems).where(eq(visitItems.visitId, id)),
  db.delete(payments).where(eq(payments.visitId, id)),
  db.delete(visits).where(eq(visits.id, id)),
]);
```

### Rate limits

Pick the right preset from `RATE_LIMITS` in `withRoute()`:
- `RATE_LIMITS.READ` — 100 req/min (list/get endpoints)
- `RATE_LIMITS.WRITE` — 30 req/min (create/update endpoints)
- `RATE_LIMITS.DESTRUCTIVE` — 10 req/min (delete endpoints)
- `RATE_LIMITS.OTP` — 10 req/10min (OTP and auth endpoints)

---

## Security non-negotiables

- **Never** store raw PAN or Aadhaar numbers — use `encrypt()` / `decrypt()` from `@/lib/encryption`
- **Never** use `Math.random()` for OTPs or secrets — use `crypto.getRandomValues()`
- **Never** interpolate user input into SQL — always use Drizzle's parameterised queries
- **Never** log PHI (patient names, phone, DOB) — log IDs only
- **Always** include `organizationId` in WHERE clauses on multi-tenant tables
- **Always** use `withRoute()` — it handles auth, rate limit, and permission in one shot

---

## Database migrations

Migration files live in `drizzle/migrations/`. They are numbered sequentially.

```bash
# Name format: NNNN_short_description.sql
# Example:     0031_add_recall_status.sql

# Apply locally
npx wrangler d1 execute parkkal-db --local \
  --file=drizzle/migrations/0031_add_recall_status.sql

# Apply to production (only when fully tested)
npx wrangler d1 execute parkkal-db \
  --file=drizzle/migrations/0031_add_recall_status.sql
```

**D1 limitations to know:**
- No `ALTER COLUMN` — to change a column type, recreate the table
- Migrations are irreversible in production — always test locally first
- `CHECK` constraints are enforced — adding an enum value needs a table recreation

---

## Environment variables

Never use `process.env.X` directly. Always import from `@/lib/env`:

```typescript
import env from "@/lib/env";
const key = env.JWT_SECRET; // validated at startup, type-safe
```

Required variables (set in `.env.local` for dev, Cloudflare secrets for prod):

| Variable | Required | Purpose |
|----------|----------|---------|
| `JWT_SECRET` | ✅ | Sign session tokens (min 32 chars) |
| `ENCRYPTION_KEY` | ✅ | Encrypt PII fields (64 hex chars = 32 bytes) |
| `RESEND_API_KEY` | ✅ | Send transactional email |
| `TWILIO_ACCOUNT_SID` | Optional | SMS OTP (skipped if unset) |
| `TWILIO_AUTH_TOKEN` | Optional | SMS OTP |
| `TWILIO_PHONE_NUMBER` | Optional | SMS OTP sender number |

---

## Testing

Tests live next to the code they test or in `__tests__/` subfolders.

```bash
npm test                        # run all tests
npm run test:watch              # watch mode for TDD
```

**What to test:**
- Pure utility functions in `src/lib/` — these are easy and high-value
- Permission logic — wrong permissions = security bug
- Zod schemas — validate that good inputs pass and bad inputs fail

**What NOT to test (leave for manual or E2E):**
- Next.js routing
- UI rendering details
- D1/database integration (test with real migrations applied locally)

---

## Git & deployment workflow

### Branch strategy

| Branch | Purpose |
|--------|---------|
| `develop` | Local development — where all work begins |
| `staging` | Pre-production validation — deployed automatically to `parkkal-dental-staging` |
| `main` | Production — only receives changes confirmed green on staging |

### Mandatory push sequence — NO EXCEPTIONS

**Every code change must follow this exact order:**

1. **Commit on `develop`** (your local working branch)
   ```bash
   git add <files>
   git commit -m "..."
   ```

2. **Push to `staging` to test**
   ```bash
   git push origin develop:staging
   ```
   This automatically builds and deploys to `parkkal-dental-staging`. Wait for a green ✅:
   ```bash
   gh run list --branch staging --limit 3
   ```

3. **Only after staging is confirmed green**, promote to `main` (production):
   ```bash
   git push origin develop:main
   ```
   Then bring your local `develop` up to date:
   ```bash
   git fetch origin
   git merge --ff-only origin/main
   ```

> **Never push directly to `main` without a confirmed staging success.**
> If staging fails, fix it on `develop` and repeat from step 2.

### What each push triggers

| Push | CI | Deploy |
|------|----|--------|
| `develop:staging` | ✅ lint · types · tests | ✅ `parkkal-dental-staging` worker + migrations |
| `develop:main` | ✅ lint · types · tests | ✅ `parkkal-dental` (prod) worker + migrations |

---

## Deployment

Deployment is via Cloudflare. **Never deploy manually** — use CI or the Wrangler CLI
only when explicitly instructed.

```bash
# Preview deployment
npx wrangler pages deploy

# This should only be run after:
# 1. npm run build passes
# 2. All migrations are applied
# 3. Secrets are set in the Cloudflare dashboard
```
