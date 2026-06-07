# Parkkal Dental Clinic — Architecture Guide

> **Who is this for?**
> Anyone making changes to this codebase — whether you've been coding for 2 years or 20.
> Read this first. It will save you hours.

---

## Table of Contents

1. [What this app does](#1-what-this-app-does)
2. [Tech stack — what and why](#2-tech-stack)
3. [Folder map — where everything lives](#3-folder-map)
4. [The 5 layers explained](#4-the-5-layers)
5. [How a page works — step by step](#5-how-a-page-works)
6. [How to add a new feature](#6-how-to-add-a-new-feature)
7. [Database rules](#7-database-rules)
8. [Security rules — non-negotiable](#8-security-rules)
9. [Common patterns with code examples](#9-common-patterns)
10. [Running and deploying](#10-running-and-deploying)

---

## 1. What this app does

Parkkal is a management system for a dental clinic. It lets staff:

- **Register and manage patients** (name, phone, medical history, PAN/Aadhaar)
- **Book and manage appointments**
- **Record clinic visits** — what happened, what was prescribed, what was charged
- **Track treatment plans** across multiple visits (e.g. root canal that takes 3 sessions)
- **Manage billing** — bill items, collect payments, generate invoices
- **Manage staff** — roles, salaries, permissions
- **Upload files** — X-rays, lab reports, consent documents

---

## 2. Tech stack

| What | Why |
|------|-----|
| **Next.js 15** (App Router) | Pages and API routes in one project. No separate backend needed. |
| **TypeScript** | Catches mistakes before they reach patients. Always use types. |
| **Tailwind CSS** | Styling without writing CSS files. Classes go directly in JSX. |
| **Drizzle ORM** | Turns TypeScript code into SQL queries. See `src/db/schema.ts`. |
| **Cloudflare D1** | SQLite database that runs in the cloud. Free and fast. |
| **Cloudflare Workers** | Where the app is deployed. Edge computing — fast worldwide. |
| **Zod** | Validates data from forms and API requests before trusting it. |
| **jose** | Signs and verifies JWT tokens (login sessions). |
| **bcryptjs** | Hashes passwords so we never store them in plain text. |
| **Resend** | Sends emails (OTPs, invitations). |
| **Vitest** | Runs automated tests. Always run before deploying. |

---

## 3. Folder map

```
parkkal/
│
├── src/
│   ├── app/                    ← Next.js pages and API routes
│   │   ├── api/                ← SERVER-SIDE: API endpoints
│   │   │   ├── patients/       ← /api/patients
│   │   │   ├── visits/         ← /api/visits
│   │   │   ├── treatments/     ← /api/treatments
│   │   │   ├── auth/           ← /api/auth/login, signup, verify...
│   │   │   └── org/            ← /api/org/members, roles, salary...
│   │   │
│   │   ├── dashboard/          ← CLIENT-SIDE: What staff see
│   │   │   ├── patients/       ← Patient list, detail, edit pages
│   │   │   ├── visits/         ← Visit list, detail, new visit
│   │   │   ├── appointments/   ← Appointment calendar
│   │   │   ├── billing/        ← Billing summary
│   │   │   ├── treatments/     ← Treatment plans
│   │   │   ├── staff/          ← Staff management
│   │   │   ├── roles/          ← Role management
│   │   │   ├── salary/         ← Salary management
│   │   │   └── settings/       ← Clinic settings
│   │   │
│   │   ├── login/              ← Login page
│   │   ├── signup/             ← Sign up page
│   │   └── activate/           ← Staff account activation
│   │
│   ├── api/                    ← ★ API CLIENT (fetch functions for each domain)
│   │   ├── index.ts            ← Import everything from here
│   │   ├── patients.ts         ← patientsApi.list(), .get(), .create()...
│   │   ├── visits.ts           ← visitsApi.list(), .items.add(), .payments.add()...
│   │   ├── treatments.ts       ← treatmentsApi.list(), .forVisit.link()...
│   │   └── _client.ts          ← Base fetch wrapper (don't import directly)
│   │
│   ├── constants/              ← ★ ALL MAGIC STRINGS LIVE HERE
│   │   ├── visit.ts            ← VISIT_STATUS, ITEM_CATEGORY, PAYMENT_METHOD
│   │   ├── treatment.ts        ← TREATMENT_STATUS, CONSENT_STATUS
│   │   ├── ui.ts               ← Badge colour classes
│   │   └── index.ts            ← Barrel export
│   │
│   ├── types/                  ← ★ ALL TYPESCRIPT SHAPES LIVE HERE
│   │   ├── patient.ts          ← Patient, PatientBalance, EmergencyContact
│   │   ├── visit.ts            ← Visit, VisitItem, Payment, Prescription
│   │   ├── treatment.ts        ← Treatment
│   │   ├── staff.ts            ← StaffMember, OrgRole, SalaryRecord
│   │   └── index.ts            ← Barrel export
│   │
│   ├── hooks/                  ← ★ SHARED REACT LOGIC
│   │   ├── use-async.ts        ← Loading/error/data state for API calls
│   │   └── use-debounce.ts     ← Delays search input by 300ms
│   │
│   ├── components/
│   │   ├── ui/                 ← Generic reusable components (Button, Table, Input...)
│   │   ├── header.tsx          ← Page title + breadcrumb bar
│   │   └── sidebar.tsx         ← Navigation sidebar
│   │
│   ├── lib/                    ← SERVER-SIDE utility functions
│   │   ├── auth.ts             ← Login, session, JWT
│   │   ├── auth-edge.ts        ← Edge-compatible JWT functions
│   │   ├── billing.ts          ← getBillingStatus(), getBalanceDue()
│   │   ├── db.ts               ← Database connection
│   │   ├── email.ts            ← Send emails via Resend
│   │   ├── encryption.ts       ← AES-256 encrypt/decrypt for PAN/Aadhaar
│   │   ├── permissions.ts      ← hasPermission() + permission constants
│   │   ├── rate-limit.ts       ← Prevent brute-force attacks
│   │   ├── sms.ts              ← Send SMS for OTPs
│   │   ├── storage.ts          ← File upload (Cloudflare R2)
│   │   └── utils.ts            ← formatCurrency(), formatDate(), calculateAge()...
│   │
│   ├── db/
│   │   └── schema.ts           ← ★ DATABASE TABLE DEFINITIONS (read this!)
│   │
│   └── middleware.ts           ← Redirects unauthenticated users to /login
│
├── drizzle/
│   └── migrations/             ← SQL files, one per schema change (never edit old ones)
│
├── docs/
│   ├── ARCHITECTURE.md         ← This file
│   ├── CONTRIBUTING.md         ← How to make changes
│   ├── ENGINEERING.md          ← Engineering standards and decisions
│   └── PRD.md                  ← Product requirements document
└── package.json
```

---

## 4. The 5 layers

Think of the codebase as 5 layers. Each layer only talks to the layers next to it.

```
┌─────────────────────────────────┐
│  1. Pages  (src/app/dashboard/) │  ← What users see. Should be THIN.
├─────────────────────────────────┤
│  2. Hooks  (src/hooks/)         │  ← Manages loading/error state
├─────────────────────────────────┤
│  3. API Client  (src/api/)      │  ← Typed fetch functions
├─────────────────────────────────┤
│  4. API Routes  (src/app/api/)  │  ← Server-side logic, auth, DB queries
├─────────────────────────────────┤
│  5. Database  (src/db/schema)   │  ← The actual data
└─────────────────────────────────┘
```

**Rule**: Pages call hooks. Hooks call the API client. The API client calls API routes. API routes talk to the database. Never skip layers.

---

## 5. How a page works

Here is the full journey of loading the patients list page:

```
User opens /dashboard/patients
         ↓
patients/page.tsx          (Layer 1: Page)
  - Calls useAsync()       (Layer 2: Hook)
  - Shows loading spinner
         ↓
useAsync()
  - Calls patientsApi.list()  (Layer 3: API Client)
         ↓
patientsApi.list()
  - Calls fetch("/api/patients?limit=25")
         ↓
/api/patients/route.ts     (Layer 4: API Route)
  - Checks: is user logged in? (getSession)
  - Checks: do they have permission? (hasPermission)
  - Runs SQL query via Drizzle  (Layer 5: Database)
  - Returns JSON
         ↓
Back up the chain → page renders the table
```

---

## 6. How to add a new feature

### Example: Add an "Allergies" field to patients

**Step 1 — Database**: Add the column in `src/db/schema.ts`:
```ts
allergies: text("allergies"),
```

**Step 2 — Migration**: Create `drizzle/migrations/0027_patient_allergies.sql`:
```sql
ALTER TABLE patients ADD COLUMN allergies TEXT;
```

**Step 3 — Types**: Add `allergies?: string | null` to `src/types/patient.ts`

**Step 4 — API Route**: Add `allergies` to the Zod schema in `src/app/api/patients/[id]/route.ts`

**Step 5 — API Client**: Add `allergies` to `UpdatePatientPayload` in `src/api/patients.ts`

**Step 6 — UI**: Add the field to the patient edit form in `src/app/dashboard/patients/[id]/edit/page.tsx`

That's it. Six files, each with one clear job.

---

## 7. Database rules

### D1 (Cloudflare SQLite) limitations — important!

| ❌ Won't work | ✅ Do this instead |
|---|---|
| `db.transaction(async (tx) => { ... })` | Sequential `await` statements |
| `ALTER TABLE t ALTER COLUMN ...` | Recreate the table (see migration 0025) |
| `ALTER TABLE t ADD CONSTRAINT CHECK ...` | Recreate the table |

### Migration rules

- **Never edit** an existing migration file — it's already been applied to production
- Create a NEW numbered file for every schema change
- One logical change per migration file
- Test locally first: `npx wrangler d1 execute parkkal-db --local --file=drizzle/migrations/NNNN.sql`

### Encrypted columns

PAN number and Aadhaar number are encrypted before storing in the database.
Only ADMIN role can see them decrypted. Use `encryptField()` before storing,
`decryptField()` before returning. See `src/lib/encryption.ts`.

---

## 8. Security rules — non-negotiable

Every API route MUST have these two checks at the top:

```ts
// 1. Is the user logged in?
const session = await getSession(request);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// 2. Do they have the right permission?
if (!await hasPermission(session, PERMISSIONS.PATIENTS_VIEW)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Permissions** are defined in `src/lib/permissions.ts`. Each action (view, create, edit, delete) is a separate permission string.

**Never trust input** — all data from forms or API requests must go through a Zod schema before you use it. If Zod says it's invalid, reject it.

**Never print patient data** in console.log or error messages. PAN, Aadhaar, medical history are PHI (Protected Health Information).

---

## 9. Common patterns with code examples

### Fetching data in a page

```tsx
"use client";
import { useAsync } from "@/hooks/use-async";
import { patientsApi } from "@/api";

export default function PatientsPage() {
  const { data, loading, error, refetch } = useAsync(
    () => patientsApi.list({ limit: 25 }),
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return <div>{data?.patients.map(p => <div key={p.id}>{p.name}</div>)}</div>;
}
```

### Using constants for status badges

```tsx
import { BILLING_STATUS_BADGE } from "@/constants/ui";
import { getBillingStatus } from "@/lib/billing";

const status = getBillingStatus(visit.totalAmount, visit.paidAmount);
// status is "PAID" | "PARTIAL" | "PENDING"

<span className={BILLING_STATUS_BADGE[status]}>{status}</span>
```

### Handling API errors

```tsx
import { ApiError } from "@/api";

try {
  await visitsApi.delete(visitId);
  setSuccessMessage("Visit deleted.");
} catch (e) {
  if (e instanceof ApiError && e.status === 422) {
    setError(e.message); // e.g. "Cannot delete a visit with recorded payments"
  } else {
    setError("Something went wrong. Please try again.");
  }
}
```

### Adding a new API route

Every route follows this template:

```ts
/**
 * API Route: /api/your-resource
 * GET  — describe what GET does
 * POST — describe what POST does
 * Who can call: role or permission needed
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  // 1. Auth check
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Permission check
  if (!await hasPermission(session, PERMISSIONS.YOUR_PERMISSION)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Your logic here
  const db = getDb();
  const rows = await db.select().from(yourTable).where(...);

  return NextResponse.json({ items: rows });
}
```

---

## 10. Running and deploying

### Local development

```bash
npm install           # Install dependencies
npm run dev           # Start local server at http://localhost:3000
```

Set up the local database (first time only):
```bash
node scripts/setup-local-db.js
```

### Running tests

```bash
npx vitest run        # Run all tests once
npx vitest            # Run tests in watch mode (re-runs on file save)
```

Always run tests before committing. All 32 tests must pass.

### Type checking and linting

```bash
npx tsc --noEmit                        # Check TypeScript — must show 0 errors
npx eslint src --max-warnings 0         # Check code style — must show 0 warnings
```

### Deploying to production

```bash
npm run cf:deploy     # Build + deploy to Cloudflare Workers
```

> ⚠️ **Never deploy without running tests first.**
> The command is `npm run cf:deploy` — NOT `npm run build`.

### Apply a database migration to production

```bash
npx wrangler d1 execute parkkal-db --file=drizzle/migrations/NNNN_your_migration.sql
```

---

*Last updated: June 2026*
