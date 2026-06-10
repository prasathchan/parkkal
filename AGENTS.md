# AGENTS.md — Codex Agent Handbook for Parkkal

> This file is read automatically by OpenAI Codex. It is the single source of
> truth for how to work in this codebase. Read it fully before writing any code.

---

## Project snapshot

**Parkkal** is a multi-tenant SaaS for dental clinics (India).
One organisation = one clinic. Staff log in, manage patients, record visits,
track treatment plans, and handle billing.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 — App Router |
| Deployment | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite at the edge) |
| ORM | Drizzle ORM |
| Email | Resend |
| SMS / WhatsApp | Twilio (trial account — only verified numbers) |
| File storage | Cloudflare R2 (via `src/lib/storage.ts`) |
| Styling | Tailwind CSS v3 |
| Validation | Zod (everywhere — never raw `typeof` checks) |
| Testing | Vitest |

---

## Non-negotiable rules — violating these breaks the app

### 1. Pages never call `fetch()` directly
```typescript
// ✅ CORRECT
import { patientsApi } from "@/api";
const { patients } = await patientsApi.list({ search });

// ❌ WRONG
const res = await fetch("/api/patients?search=" + search);
```

### 2. Every API route uses `withRoute()`
```typescript
// ✅ CORRECT
export const GET = withRoute(
  { route: "GET /api/patients", permission: PERMISSIONS.PATIENTS_VIEW },
  async (req, { session, db }) => {
    return apiOk({ patients });
  }
);

// ❌ WRONG — manual auth, no rate limit, no audit
export async function GET(req: NextRequest) { ... }
```

### 3. Magic strings live in `@/constants` only
```typescript
// ✅
import { VISIT_STATUS } from "@/constants";
if (visit.status === VISIT_STATUS.COMPLETED) { ... }

// ❌
if (visit.status === "COMPLETED") { ... }
```

### 4. Multi-tenancy — every query must filter by orgId
```typescript
// ✅ REQUIRED on every query against a patient/visit/appointment table
.where(and(
  eq(patients.organizationId, session.orgId),
  eq(patients.id, id),
))
// ❌ Missing organizationId leaks data between clinics
```

### 5. Never use `process.env` directly
```typescript
import env from "@/lib/env";   // ✅ validated, type-safe
process.env.JWT_SECRET;         // ❌
```

---

## Codebase map

```
src/
├── api/               ← CLIENT-SIDE typed API wrappers
│   ├── _client.ts     ← base apiFetch() + ApiError
│   ├── patients.ts
│   ├── visits.ts
│   ├── treatments.ts
│   ├── appointments.ts
│   ├── recalls.ts
│   ├── org.ts
│   ├── auth.ts
│   ├── invoices.ts
│   ├── admin.ts
│   └── index.ts       ← BARREL — always import from "@/api"
│
├── app/
│   ├── api/           ← SERVER route handlers (Next.js Route Handlers)
│   └── dashboard/     ← UI pages ("use client" where interactive)
│
├── components/
│   ├── ui/            ← Button, Modal, Skeleton, etc.
│   ├── visits/        ← tab components for visit detail
│   └── treatments/    ← modals for treatment plans
│
├── constants/         ← ALL magic strings (import from "@/constants")
│   ├── visit.ts       ← VISIT_STATUS, ITEM_CATEGORY, PAYMENT_METHOD
│   ├── treatment.ts   ← TREATMENT_STATUS, CONSENT_STATUS
│   └── index.ts
│
├── db/
│   ├── schema.ts      ← EVERY table defined here (Drizzle)
│   └── relations.ts
│
├── lib/               ← Server-only utilities
│   ├── api.ts         ← withRoute() HOF — USE THIS FOR EVERY ROUTE
│   ├── auth.ts        ← getSession(), JWT helpers
│   ├── db.ts          ← getDb() — call with no args in route handlers
│   ├── permissions.ts ← PERMISSIONS object
│   ├── encryption.ts  ← encryptField() / decryptField() for PII
│   ├── audit.ts       ← writeAuditLog() for compliance
│   ├── billing.ts     ← billing status helpers
│   ├── notifications.ts ← sendNotification() — SMS / WhatsApp / Email
│   ├── reminder-scheduler.ts ← scheduleReminders(), cancelReminders()
│   ├── calendar-sync.ts ← Google + Outlook OAuth sync
│   └── schemas/       ← Zod request schemas shared across routes
│
└── types/             ← TypeScript interfaces (import from "@/types")
```

---

## How to add a new API endpoint (checklist)

1. Create route file at `src/app/api/your-feature/route.ts`
2. Add Zod schema in `src/lib/schemas/` if body validation needed
3. Write handler with `withRoute()`, pick permission from `PERMISSIONS`
4. Add typed client function in `src/api/your-feature.ts`
5. Export from `src/api/index.ts`
6. Add TypeScript interface in `src/types/your-feature.ts`

## How to add a new dashboard page (checklist)

1. Create `src/app/dashboard/your-feature/page.tsx`
2. Add `"use client"` at top if interactive
3. Use `useAsync()` hook from `@/hooks/use-async` for data fetching
4. Import from `@/api` — never raw fetch
5. Add nav link in `src/components/sidebar.tsx`

## How to add a database column (checklist)

1. Edit `src/db/schema.ts`
2. Write `drizzle/migrations/NNNN_description.sql`
3. Update TypeScript type in `src/types/`
4. Update API route + typed client
5. Tell the human to run: `node scripts/setup-local-db.js`

---

## Key utilities — use these, don't reinvent

| Utility | Import | Purpose |
|---------|--------|---------|
| `withRoute()` | `@/lib/api` | Wraps every route handler (auth + rate limit + permission) |
| `apiOk(data)` | `@/lib/api` | Returns 200 JSON |
| `getDb()` | `@/lib/db` | Gets Drizzle DB instance in a route handler |
| `runCascade(db, ops)` | `@/lib/db` | Atomic multi-table delete |
| `encryptField(val)` | `@/lib/encryption` | AES-256-GCM encrypt PII |
| `decryptField(val)` | `@/lib/encryption` | Decrypt PII |
| `writeAuditLog(...)` | `@/lib/audit` | Write compliance audit entry |
| `sendNotification(...)` | `@/lib/notifications` | Send SMS/WhatsApp/Email |
| `scheduleReminders(...)` | `@/lib/reminder-scheduler` | Schedule appointment reminders |
| `PERMISSIONS` | `@/lib/permissions` | All permission constants |
| `RATE_LIMITS` | `@/lib/api` | READ=100/min, WRITE=30/min, DESTRUCTIVE=10/min |

---

## Rate limit presets

```typescript
withRoute({ route: "GET ...",    rateLimit: RATE_LIMITS.READ })        // 100/min
withRoute({ route: "POST ...",   rateLimit: RATE_LIMITS.WRITE })       // 30/min
withRoute({ route: "DELETE ...", rateLimit: RATE_LIMITS.DESTRUCTIVE }) // 10/min
withRoute({ route: "POST /otp",  rateLimit: RATE_LIMITS.OTP })         // 10/10min
```

---

## Error handling pattern (client side)

```typescript
try {
  await patientsApi.create(payload);
} catch (err) {
  if (err instanceof ApiError) {
    // err.status  → HTTP status code
    // err.message → human-readable message
    // err.details → Zod field errors array
  }
}
```

---

## Atomic deletes — always use runCascade

```typescript
await runCascade(db, [
  db.delete(visitItems).where(eq(visitItems.visitId, id)),
  db.delete(payments).where(eq(payments.visitId, id)),
  db.delete(visits).where(eq(visits.id, id)),
]);
```

---

## Security non-negotiables

- **Never** store raw PAN/Aadhaar — use `encryptField()` / `decryptField()`
- **Never** use `Math.random()` for secrets — use `crypto.getRandomValues()`
- **Never** interpolate user input into SQL — always use Drizzle queries
- **Never** log patient names, phone, or DOB — log IDs only
- **Always** filter by `organizationId` in multi-tenant table queries
- **Always** use `withRoute()` for every route handler

---

## Database migrations

Files live in `drizzle/migrations/`, numbered sequentially (e.g. `0034_...sql`).

D1 limitations:
- No `ALTER COLUMN` — recreate table to change column type
- No reversible migrations in production
- `CHECK` constraints are enforced — adding enum values needs table recreation

---

## Commands

```bash
npm run dev                          # dev server localhost:3000
npx tsc --noEmit                     # type-check
npm test                             # run tests
npm run lint                         # lint
npm run build                        # production build
node scripts/setup-local-db.js       # apply all migrations locally
```

---

## What Codex should NOT do

- Do not run `rm -rf` or destructive shell commands
- Do not run DB migrations (`wrangler d1 execute` against production)
- Do not add new npm packages without flagging them with a comment `// NEW DEP: <reason>`
- Do not deploy (`wrangler pages deploy`)
- Do not print or log patient records (PHI)
- Do not bypass `withRoute()` for any API route
