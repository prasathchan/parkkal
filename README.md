# Parkkal Dental — Practice Management System

A production-grade, multi-tenant dental clinic management SaaS built on the Cloudflare edge stack. Parkkal handles the full patient journey — appointment scheduling, clinical visit records, treatment plans with digital consent, billing, payments, prescriptions, and staff management — all from a single, fast, browser-based interface purpose-built for busy clinic environments with unreliable internet and high staff turnover.

Every clinic is a fully isolated **organization**. A user account can belong to multiple organizations (multi-clinic doctor, admin). All patient data, billing, and clinical records are scoped to the organization — there is no data bleed between clinics.

---

## Documentation

| Doc | Description |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system is built — layers, folder map, data flow, security model |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Golden rules, pre-commit checklist, commit message format |
| [ENGINEERING.md](docs/ENGINEERING.md) | Engineering standards, ADRs, and technical decisions |
| [PRD.md](docs/PRD.md) | Product requirements and feature specifications |

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Database Migrations](#database-migrations)
- [Deployment](#deployment)
- [Key Architectural Decisions](#key-architectural-decisions)
- [Contributing](#contributing)

---

## Tech Stack

| Technology | Role | Rationale |
|---|---|---|
| **Next.js 15 (App Router)** | Full-stack framework | Server components for dashboard layout + data fetching; Route Handlers for all API endpoints. Co-locates UI and API in one repo, one deploy. |
| **TypeScript (strict)** | Language | Strict mode catches PHI handling mistakes and type errors at compile time, not in a patient record at 9 PM. |
| **Tailwind CSS** | Styling | Utility-first CSS is easy to theme dynamically (per-org branding) without CSS-in-JS overhead. |
| **Drizzle ORM** | Database client | Type-safe, zero-overhead SQL builder with native D1/SQLite support. Schema-first: TypeScript types and DB columns are always in sync. |
| **Cloudflare D1** | Database | Managed SQLite at the edge. Zero-ops, globally replicated. Key limitation: no transactions — see [Architectural Decisions](#key-architectural-decisions). |
| **Cloudflare R2** | File storage | S3-compatible object storage, zero egress fees. Used for patient attachments (X-rays, reports) and consent documents. Files are served through an authenticated API route, never directly from R2 URLs. |
| **Cloudflare Workers** | Compute | V8 isolates — sub-millisecond cold starts, global deployment. The Next.js app deploys via `@opennextjs/cloudflare`. |
| **`jose`** | JWT | Fully edge-compatible. No Node.js crypto dependencies. Used in `middleware.ts` which runs in the edge runtime. |
| **`bcryptjs`** | Password hashing | Pure-JS bcrypt. Works in the edge runtime where native `crypto.subtle` lacks bcrypt support. |
| **Zod** | Input validation | Schema-based validation at every API route boundary. Never trust client input. |
| **Anthropic Claude Haiku** | AI consent verification | Vision model checks uploaded consent form images for legibility and presence of a signature. Falls back gracefully when API key is not configured. |

---

## Prerequisites

- **Node.js 20+** — the codebase uses `crypto.randomUUID()` and `crypto.getRandomValues()` natively
- **Cloudflare account** with Workers, D1, and R2 access enabled
- **Wrangler CLI 3+**: `npm install -g wrangler`
- **Wrangler authenticated**: `wrangler login`

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/prasathchan/parkkal.git
cd parkkal
npm install
```

### 2. Apply database migrations locally

```bash
npm run db:migrate
# Runs: wrangler d1 migrations apply parkkal-db --local
# Creates .wrangler/state/v3/d1/ with a local SQLite file
```

### 3. Configure environment variables

Create `.env.local` in the project root:

```bash
# Required for auth (minimum 32 random characters)
JWT_SECRET=your-super-secret-key-minimum-32-chars

# Optional: AI consent verification. Without this, uploads are auto-approved.
ANTHROPIC_API_KEY=sk-ant-api...

# Required for OTP and staff invite emails
EMAIL_API_KEY=re_...
EMAIL_FROM=noreply@yourapp.com

# Required for phone OTP
SMS_API_KEY=...
```

### 4. Start the development server

```bash
npm run dev          # Next.js dev server on http://localhost:3000
# or
wrangler dev         # Cloudflare Workers runtime on http://localhost:8787
#                      (more accurate for production behavior)
```

In dev mode: `getDb()` uses a local SQLite file instead of D1; `storeFile()` writes to `private_uploads/` instead of R2; rate limiting uses in-memory state.

### 5. Create your first account

Navigate to `http://localhost:3000/signup`. Enter your name, email, phone, password, and clinic name. Complete the email + phone OTP verification. You will be redirected to the dashboard as the clinic ADMIN.

---

## Environment Variables

### Application secrets (`.env.local` for dev, `wrangler secret put` for prod)

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | Signs all JWT cookies. Must be ≥ 32 random bytes. Generate: `openssl rand -base64 32`. Production throws on startup if absent. |
| `ANTHROPIC_API_KEY` | No | Claude Haiku consent form verification. If absent, image uploads default to `UPLOADED` status pending manual review. |
| `EMAIL_API_KEY` | Yes (for OTPs) | Transactional email provider API key. See `src/lib/email.ts`. |
| `EMAIL_FROM` | Yes (for OTPs) | Verified sender address for OTPs and staff invites. |
| `SMS_API_KEY` | Yes (for OTPs) | SMS provider key for phone OTP delivery. See `src/lib/sms.ts`. |
| `NODE_ENV` | Auto-set | Controls secure cookie flags. Always `production` after Wrangler deploy. |

### Cloudflare bindings (`wrangler.toml` — not `process.env`)

| Binding | Type | Purpose |
|---|---|---|
| `DB` | D1 Database | Primary SQLite database. All `getDb()` calls use this binding in production. |
| `FILES` | R2 Bucket | File storage for attachments, consent forms, and org logos. |

> **Important:** D1 and R2 bindings are **not** environment variables. They are accessed via `getCloudflareContext().env.DB` and `getCloudflareContext().env.FILES`. Do not attempt to read them from `process.env`.

---

## Project Structure

```
parkkal/
│
├── wrangler.toml              ← Cloudflare Worker config: D1 binding, R2 binding, worker name, routes
├── next.config.ts             ← Next.js config (Cloudflare adapter)
├── drizzle.config.ts          ← Drizzle Kit config
│
├── docs/                      ← Project documentation (architecture, contributing, PRD)
├── drizzle/
│   └── migrations/            ← SQL files: 0001_init.sql → latest. Never modify existing files.
│
└── src/
    ├── middleware.ts          ← Edge auth gate: JWT validation, CSP headers, route protection
    │
    ├── db/
    │   └── schema.ts          ← Single source of truth for all DB tables and columns (Drizzle schema)
    │
    ├── lib/
    │   ├── auth-edge.ts       ← JWT: createToken, createOrgToken, verifyOrgToken, getSession()
    │   ├── auth.ts            ← Re-exports auth-edge + bcrypt: hashPassword, verifyPassword
    │   ├── billing.ts         ← getBillingStatus(), getBalanceDue(), getTreatmentOutstanding()
    │   ├── db.ts              ← getDb() — D1 in prod, libsql in dev
    │   ├── encryption.ts      ← AES-256-GCM field encryption for PAN/Aadhaar
    │   ├── logger.ts          ← Structured JSON logger with context + automatic redaction
    │   ├── permissions.ts     ← hasPermission(), PERMISSIONS constants
    │   ├── rate-limit.ts      ← checkRateLimit(), getClientIp() — D1-backed + in-memory fallback
    │   ├── storage.ts         ← storeFile(), getFile(), deleteFile() — R2 in prod, local in dev
    │   ├── email.ts           ← sendEmailOTP(), sendStaffInviteEmail()
    │   ├── sms.ts             ← sendSMSOTP()
    │   ├── utils.ts           ← formatCurrency, formatDoctorName, generateId, cn()
    │   ├── theme.ts           ← parseThemeConfig, getSidebarColors
    │   └── default-roles.ts   ← DEFAULT_ROLES seeded when a new org is created at signup
    │
    ├── components/
    │   ├── header.tsx         ← Page header with breadcrumb navigation
    │   ├── sidebar.tsx        ← Navigation sidebar; shows/hides items based on user role
    │   ├── stat-card.tsx      ← KPI card for dashboard home
    │   ├── theme-provider.tsx ← Injects per-org CSS variables (colors, fonts)
    │   └── ui/                ← Primitive components: badge, button, card, table, input, select
    │
    └── app/
        │
        ├── error.tsx          ← React error boundary (catches errors in dashboard segments)
        ├── global-error.tsx   ← Root error boundary (catches errors in root layout)
        │
        ├── login/page.tsx     ← Login form. Reads ?from= param; redirects there after auth.
        ├── select-org/page.tsx← Multi-org picker. Shown when a user belongs to >1 org.
        ├── signup/page.tsx    ← Clinic registration (name + email + phone + OTP verification)
        │
        ├── dashboard/
        │   ├── layout.tsx     ← SERVER COMPONENT: verifies JWT, fetches org theme, renders Sidebar
        │   ├── page.tsx       ← Dashboard home: 9 parallel D1 stat queries, today's appointments
        │   ├── patients/
        │   │   ├── page.tsx   ← Patient list with real-time search
        │   │   └── [id]/page.tsx ← Patient detail: tabs for visits, treatments, invoices
        │   ├── appointments/
        │   │   ├── page.tsx   ← Appointment list with date + status filters + Load More
        │   │   └── new/page.tsx ← New appointment form with conflict detection feedback
        │   ├── visits/
        │   │   ├── page.tsx   ← Visit list with debounced search + Load More
        │   │   ├── new/page.tsx ← 3-step wizard: patient → appointment → clinical details
        │   │   └── [id]/page.tsx ← Visit detail: items, payments, attachments, prescriptions, treatment plan
        │   ├── treatments/page.tsx ← Treatment list with consent status badges + Load More
        │   ├── billing/       ← Visit billing overview
        │   ├── invoices/      ← Standalone invoices (ADMIN/RECEPTIONIST)
        │   ├── staff/         ← Staff list + add/edit/deactivate (ADMIN only)
        │   ├── salary/        ← Salary records (ADMIN only)
        │   ├── roles/         ← Custom org roles management (ADMIN only)
        │   └── settings/      ← Org profile, logo, theme, danger zone
        │
        └── api/
            ├── auth/
            │   ├── login/route.ts           POST: email+password → JWT cookie
            │   ├── signup/route.ts          POST: create user + org + OTPs
            │   ├── verify/route.ts          POST: validate OTPs, activate account
            │   ├── resend-otp/route.ts      POST: regenerate OTP codes (IP + userId rate limited)
            │   ├── select-org/route.ts      POST: issue org-scoped JWT for multi-org users
            │   ├── logout/route.ts          POST: clear session cookies
            │   ├── change-password/route.ts POST: verify current + set new password
            │   └── me/route.ts              GET: current user + role
            │
            ├── patients/
            │   ├── route.ts                 GET (search), POST (create + emergency contact)
            │   └── [id]/route.ts            GET, PATCH, DELETE (ADMIN only delete)
            │
            ├── appointments/
            │   ├── route.ts                 GET (paginated, RBAC-scoped), POST (with time conflict check)
            │   └── [id]/route.ts            PATCH status
            │
            ├── visits/
            │   ├── route.ts                 GET (paginated, search, RBAC), POST (create + visit code)
            │   └── [id]/
            │       ├── route.ts             GET (full visit detail), PATCH (clinical RBAC), DELETE (ADMIN)
            │       ├── items/
            │       │   ├── route.ts         GET, POST (add item + SUM recompute totalAmount)
            │       │   └── [itemId]/route.ts PATCH, DELETE (both SUM recompute totalAmount)
            │       ├── payments/route.ts    GET, POST (SUM recompute paidAmount)
            │       ├── attachments/route.ts GET, POST (R2 upload)
            │       └── prescriptions/route.ts GET, POST
            │
            ├── treatments/
            │   ├── route.ts                 GET (paginated + consent fields), POST
            │   └── [id]/
            │       ├── route.ts             PATCH (status machine), DELETE
            │       └── consent/
            │           ├── route.ts         GET consent info, PATCH emergency override
            │           └── upload/route.ts  POST: upload to R2 + AI verify via Claude Haiku
            │
            ├── invoices/
            │   ├── route.ts                 GET (paginated, ADMIN/RECEPTIONIST/DOCTOR), POST (ADMIN/RECEPTIONIST)
            │   └── [id]/route.ts            GET, PATCH paidAmount (ADMIN/RECEPTIONIST)
            │
            ├── org/
            │   ├── members/
            │   │   ├── route.ts             GET (strip PHI for non-ADMIN), POST (invite staff)
            │   │   └── [userId]/route.ts    PATCH (role/salary/active), DELETE (self-removal blocked)
            │   ├── salary/route.ts          GET, POST, PATCH (ADMIN only)
            │   ├── roles/route.ts           GET, POST, PATCH, DELETE custom org roles
            │   ├── profile/route.ts         PATCH org name/address/contact
            │   └── logo/route.ts            POST: upload org logo to R2
            │
            └── files/[...path]/route.ts     ← Serves R2 files with session auth + path traversal guard
```

---

## Database Migrations

All schema changes are SQL files in `drizzle/migrations/`. They are applied in numeric order and tracked in a `d1_migrations` table in D1.

### Apply pending migrations

```bash
# Local development
npm run db:migrate
# Production
npm run db:migrate:prod
```

### Write a new migration

1. Create the next numbered file:
   ```bash
   touch drizzle/migrations/0015_add_referring_doctor.sql
   ```

2. Write the SQL:
   ```sql
   ALTER TABLE visits ADD COLUMN referring_doctor_id TEXT REFERENCES users(id);
   CREATE INDEX IF NOT EXISTS idx_visits_referring ON visits(referring_doctor_id);
   ```

3. Update `src/db/schema.ts` to add the new column to the Drizzle table definition.

4. Apply locally, verify the app works, then apply to production:
   ```bash
   npm run db:migrate        # local
   npm run db:migrate:prod   # production
   ```

> **Never modify existing migration files.** D1 has no transactional DDL. If a migration partially fails, fix the SQL and re-apply the corrected file. If a migration was applied manually but not tracked in `d1_migrations`, insert the record:
> ```sql
> INSERT INTO d1_migrations (name, applied_at)
> VALUES ('0015_add_referring_doctor.sql', datetime('now'))
> ON CONFLICT(name) DO NOTHING;
> ```

---

## Deployment

### Deploy to production

```bash
npm run cf:deploy
# Equivalent to: opennextjs-cloudflare build && wrangler deploy
```

### First-time production setup checklist

```bash
# 1. Create D1 database
wrangler d1 create parkkal-db
# → Copy the database_id into wrangler.toml

# 2. Create R2 bucket
wrangler r2 bucket create parkkal-files

# 3. Apply all migrations
npm run db:migrate:prod

# 4. Set secrets
wrangler secret put JWT_SECRET        # openssl rand -base64 32
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put EMAIL_API_KEY
wrangler secret put SMS_API_KEY

# 5. Deploy
npm run cf:deploy
```

### Deployment gotchas

| Issue | Cause | Fix |
|---|---|---|
| `getCloudflareContext() called outside request` | Called at module scope | Move all `getDb()`, `getD1()` calls inside request handlers, never at import time |
| `duplicate column name` on migration | Migration applied manually but not tracked | Insert the tracking record into `d1_migrations` manually |
| White screen after deploy | New columns/tables not yet in D1 | Always `db:migrate:prod` **before** `cf:deploy` |
| `JWT_SECRET is not set` | Secret not provisioned | `wrangler secret put JWT_SECRET` |
| Consent AI verification silently disabled | `ANTHROPIC_API_KEY` not set | Expected behavior — uploads go to `UPLOADED` status for manual review |

---

## Key Architectural Decisions

### 1. D1 without transactions: the SUM recompute pattern

D1 does not support multi-statement transactions. The standard `INSERT child row, then UPDATE parent += delta` is not atomic — two concurrent inserts both read the same stale aggregate, both pass a balance check, both insert, but only one delta write wins. The other is silently lost.

The fix used throughout this codebase: **recompute the aggregate from the source of truth after every mutation**:

```sql
-- After inserting a payment (payments/route.ts):
UPDATE visits
SET paid_amount = MIN(total_amount,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE visit_id = ?))
WHERE id = ?;

-- After adding/editing/deleting a visit item ([itemId]/route.ts):
UPDATE visits
SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM visit_items WHERE visit_id = ?)
WHERE id = ?;
```

This is self-healing: any prior drift is corrected on the next mutation, regardless of history.

### 2. Two-cookie authentication

`pkd_session` (1h): issued after password verification when the user belongs to multiple organizations. Used only to confirm identity during org selection — it has no `orgId` claim and cannot access org data.

`pkd_org_session` (24h): the primary session. Carries `userId`, `email`, `name`, `orgId`, `orgSlug`, `orgName`, `role`. Issued after org selection (or immediately on login for single-org users). All authenticated routes read this cookie.

Both are `HttpOnly`, `SameSite=strict`, `Secure` (in production). Neither is accessible from JavaScript.

### 3. Defense in depth for authorization

- **Middleware** (`middleware.ts`): validates `pkd_org_session` before the request reaches any route handler. Rejects without a valid JWT.
- **Per-route `getSession()`**: every API route independently validates the session and uses `session.orgId` in all DB WHERE clauses.
- **DB-layer org scoping**: org isolation is enforced in the SQL `WHERE` clause (`eq(table.organizationId, session.orgId)`), not by comparing a fetched value after the query. Both layers must fail for a cross-org read to succeed.

### 4. RBAC enforcement is server-side only

The sidebar hides menu items based on role, but this is purely cosmetic. All authorization is enforced in API route handlers using `session.role`. The client cannot elevate privileges by navigating to a URL.

---

## Contributing

1. `npx tsc --noEmit` must pass cleanly before every commit.
2. Every new API route must start with `const session = await getSession(request); if (!session) return 401`.
3. All D1 queries on clinical tables must include `eq(table.organizationId, session.orgId)` in the `WHERE` clause — never fetch by ID alone and check org afterward.
4. Use `crypto.randomUUID()` for all new record IDs. Use `crypto.getRandomValues()` for OTP codes and security tokens. Never use `Math.random()` for anything security-related.
5. PHI fields (`panNumber`, `aadhaarNumber`, `medicalHistory`) must be stripped or nulled in API responses for non-ADMIN roles.
6. Financial aggregates must use SUM recompute, not incremental `+= delta`.
7. New schema changes require a new numbered SQL migration file. Never modify existing migration files.
8. Branch: develop on `develop`. Feature branches merge into `develop` via PR.
