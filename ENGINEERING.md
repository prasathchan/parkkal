# Parkkal Engineering Guide

This document is for engineers new to the codebase. It explains how every major system works, where to find code, and exactly how to extend the application without breaking things. Read it top to bottom once, then use it as a reference.

---

## Table of Contents

1. [How Authentication Works End-to-End](#1-how-authentication-works-end-to-end)
2. [How to Add a New API Route](#2-how-to-add-a-new-api-route)
3. [How to Add a New Dashboard Page](#3-how-to-add-a-new-dashboard-page)
4. [Database Schema Guide](#4-database-schema-guide)
5. [The SUM Recompute Pattern](#5-the-sum-recompute-pattern)
6. [RBAC Reference](#6-rbac-reference)
7. [How to Run a DB Migration](#7-how-to-run-a-db-migration)
8. [Common Pitfalls](#8-common-pitfalls)
9. [File Storage Pattern](#9-file-storage-pattern)
10. [Rate Limiting](#10-rate-limiting)
11. [Feature Flags](#11-feature-flags)
12. [How to Verify Your Changes Work](#12-how-to-verify-your-changes-work)

---

## 1. How Authentication Works End-to-End

Understanding auth is essential before touching any route. Here is the complete flow from "user opens browser" to "user sees the dashboard".

### The Login Flow

```
User submits email + password
        ↓
POST /api/auth/login
  → verifyPassword(password, user.passwordHash)
  → if user belongs to 1 org:
      createOrgToken({ userId, orgId, role, ... })
      → Set cookie: pkd_org_session (24h, HttpOnly, SameSite=strict)
      → Return { redirect: "/dashboard" }
  → if user belongs to >1 org:
      createToken({ userId, email, name })
      → Set cookie: pkd_session (1h, HttpOnly, SameSite=strict)
      → Return { requireOrgSelection: true, organizations: [...] }
        ↓
     /select-org page (reads org list from sessionStorage)
        ↓
     POST /api/auth/select-org
       → verifyToken(pkd_session cookie)
       → createOrgToken({ userId, orgId, role, ... })
       → Set cookie: pkd_org_session (24h)
       → Return { redirect: "/dashboard" }
```

### The Signup Flow

```
User submits name, email, phone, password, clinicName
        ↓
POST /api/auth/signup
  → Creates: user (isActive=0), organization (isActive=0), organizationMember (isActive=0)
  → Creates: email OTP token + phone OTP token (15 min expiry)
  → Sends OTP via email (sendEmailOTP) and SMS (sendSMSOTP)
  → Returns: { userId }
        ↓
User enters 6-digit codes on /verify page
        ↓
POST /api/auth/verify
  → Validates both OTPs against verificationTokens table
  → Sets user.isActive=1, user.isVerified=1
  → Sets organization.isActive=1, organizationMember.isActive=1
  → Issues pkd_org_session cookie
  → Returns { redirect: "/dashboard" }
```

### Every Authenticated Request

```
Browser sends request with pkd_org_session cookie
        ↓
middleware.ts runs at the edge (before any route handler)
  → Reads cookie: request.cookies.get("pkd_org_session")
  → If missing: redirect /dashboard → /login?from=..., reject /api → 401
  → verifyOrgToken(token) using jose
  → If invalid: same rejection
  → Calls NextResponse.next() — request proceeds to route handler
        ↓
Route handler runs
  → const session = await getSession(request)
  → session is: { userId, email, name, orgId, orgSlug, orgName, role }
  → if (!session) return 401  ← redundant safety net, middleware already checked
  → All DB queries use: where(eq(table.organizationId, session.orgId))
```

### Key files

| File | What it does |
|---|---|
| `middleware.ts` | Edge auth gate. Runs on every `/api/*` and `/dashboard/*` request. |
| `src/lib/auth-edge.ts` | `createToken`, `createOrgToken`, `verifyToken`, `verifyOrgToken`, `getSession`. Uses `jose`. |
| `src/lib/auth.ts` | Re-exports everything from `auth-edge.ts` + adds `hashPassword` and `verifyPassword` (bcrypt). |
| `src/app/api/auth/login/route.ts` | Handles email+password auth, issues JWT cookies. |
| `src/app/api/auth/signup/route.ts` | Creates user + org + sends OTPs. |
| `src/app/api/auth/verify/route.ts` | Validates OTPs, activates account, issues session. |

---

## 2. How to Add a New API Route

Here is the exact pattern every route in this codebase follows. Copy it exactly.

### Step 1: Create the file

Route files live at `src/app/api/[feature]/route.ts` or `src/app/api/[feature]/[id]/route.ts`.

Example: Adding a `GET /api/notes` endpoint.

```
src/app/api/notes/route.ts
```

### Step 2: Write the route using this template

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notes } from "@/db/schema";          // ← your table
import { getSession } from "@/lib/auth";
import { z } from "zod";

// ── Input validation schema ───────────────────────────────────────────────────
const createNoteSchema = z.object({
  content: z.string().min(1).max(2000),
  patientId: z.string().min(1),
});

// ── GET /api/notes ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // 1. Authenticate — always first
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Read query params
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  const db = getDb();

  // 3. Query — ALWAYS include organizationId in WHERE
  const [totalResult, rows] = await Promise.all([
    db.select({ total: count() }).from(notes)
      .where(eq(notes.organizationId, session.orgId)),
    db.select().from(notes)
      .where(eq(notes.organizationId, session.orgId))
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.total ?? 0;
  return NextResponse.json({ notes: rows, total, hasMore: offset + rows.length < total });
}

// ── POST /api/notes ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // 1. Authenticate
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Optional: RBAC check
  if (!["ADMIN", "DOCTOR"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Parse body safely
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 4. Validate with Zod
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
  }

  const { content, patientId } = parsed.data;
  const db = getDb();

  // 5. Verify related records belong to this org before use
  // (don't trust the client-supplied patientId without checking)
  const [orgLink] = await db.select().from(organizationPatients)
    .where(and(
      eq(organizationPatients.organizationId, session.orgId),
      eq(organizationPatients.patientId, patientId)
    ));
  if (!orgLink) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  // 6. Insert — always include organizationId
  const newNote = {
    id: crypto.randomUUID(),              // ← always crypto.randomUUID(), never Math.random()
    organizationId: session.orgId,        // ← always session.orgId, never body.orgId
    patientId,
    content,
    createdBy: session.userId,            // ← from session, never from body
    createdAt: Date.now(),
  };

  await db.insert(notes).values(newNote);
  return NextResponse.json({ note: newNote }, { status: 201 });
}
```

### Step 3: Add the table to the schema

Open `src/db/schema.ts` and add:

```typescript
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organizations.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
  content: text("content").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
});
```

### Step 4: Write a migration

```bash
touch drizzle/migrations/0015_add_notes.sql
```

```sql
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  content TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_org ON notes(organization_id, created_at DESC);
```

### Step 5: Apply and verify

```bash
npm run db:migrate
npx tsc --noEmit
```

### Rules every route must follow

- ✅ Call `getSession(request)` first, return 401 if null
- ✅ Include `eq(table.organizationId, session.orgId)` in every WHERE clause
- ✅ Use `crypto.randomUUID()` for all new IDs
- ✅ Use `session.orgId` and `session.userId` — never trust body-supplied IDs for org or user
- ✅ Validate all input with Zod before touching the database
- ❌ Never fetch by ID alone then check org afterward (`where(eq(table.id, id))` + manual compare)
- ❌ Never use `Math.random()` for IDs, tokens, or codes

---

## 3. How to Add a New Dashboard Page

### Step 1: Create the page file

```
src/app/dashboard/notes/page.tsx
```

All dashboard pages are client components (add `"use client"` at the top) unless they only show static content.

```typescript
"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notes")
      .then(r => r.json())
      .then(data => {
        setNotes(data.notes ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Notes"
        breadcrumb={[{ label: "Dashboard" }, { label: "Notes" }]}
      />
      <main className="flex-1 p-6">
        {loading ? <p className="text-slate-400">Loading...</p> : (
          <ul>
            {notes.map(n => <li key={n.id}>{n.content}</li>)}
          </ul>
        )}
      </main>
    </div>
  );
}
```

### Step 2: Add to the sidebar navigation

Open `src/components/sidebar.tsx`. Find the `navItems` array and add your entry:

```typescript
const navItems = [
  // ... existing items ...
  {
    href: "/dashboard/notes",
    label: "Notes",
    icon: <NoteIcon />,
    // adminOnly: true,   ← add this if only ADMIN should see it
  },
];
```

### Step 3: Verify the layout wraps it

The dashboard layout at `src/app/dashboard/layout.tsx` wraps all dashboard pages automatically. You do not need to add anything there.

### Step 4: Add the breadcrumb

The `Header` component accepts `breadcrumb` as an array:

```typescript
<Header
  title="Notes"
  breadcrumb={[
    { label: "Dashboard", href: "/dashboard" },
    { label: "Notes" }
  ]}
/>
```

### Common page patterns

**Paginated list with Load More** — see `src/app/dashboard/visits/page.tsx` as the reference implementation. Key elements:
- `const [offset, setOffset] = useState(0)` — tracks current position
- `fetchVisits(pageOffset, append = false)` — `append=true` adds to existing list
- `total` and `hasMore` from the API
- "Load more (N remaining)" footer button

**Debounced search** — see `src/app/dashboard/visits/page.tsx`:
```typescript
const [search, setSearch] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");
const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (searchTimer.current) clearTimeout(searchTimer.current);
  searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
  return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
}, [search]);
```

**Role-based UI** — fetch the current user's role and conditionally render:
```typescript
const [role, setRole] = useState<string | null>(null);
useEffect(() => {
  fetch("/api/auth/me").then(r => r.json()).then(d => setRole(d.role));
}, []);
```

---

## 4. Database Schema Guide

All tables are defined in `src/db/schema.ts`. Here is what each table does and how they relate.

### Core tables

```
organizations          — One row per clinic. Every other clinical table references this.
users                  — One row per staff account. A user can belong to multiple orgs.
organizationMembers    — Links users to organizations. Stores role + salary.
```

### Multi-tenancy pattern

Every clinical table has an `organization_id` column. All queries must filter by it:

```typescript
// ✅ Correct — always filter by org
db.select().from(visits).where(eq(visits.organizationId, session.orgId))

// ❌ Wrong — cross-org data leak
db.select().from(visits).where(eq(visits.id, someId))
```

### Patient tables

```
patients               — Core patient record (name, phone, DOB, blood group, PHI)
organizationPatients   — Links patients to orgs (a patient can be at multiple clinics)
emergencyContacts      — Emergency contact info for patients or users
```

A patient has a **global patient code** (`PKL-000001`) in `patients.patientCode` and an **org-specific code** (`ABC-0001`) in `organizationPatients.patientCode`.

### Appointment and visit tables

```
appointments           — Scheduled slots (date + time + doctor + status)
visits                 — Actual clinical encounters (notes, diagnosis, billing)
visitItems             — Line items for a visit (procedure, medicine, X-ray — each with price)
payments               — Money received against a visit
attachments            — Files (X-rays, reports) uploaded to a visit
prescriptions          — Medicine prescriptions linked to a visit
```

**Key relationships:**
- A visit can be linked to an appointment (`visits.appointmentId`)
- A visit's `totalAmount` = `SUM(visitItems.amount)` — always recomputed, never cached
- A visit's `paidAmount` = `MIN(totalAmount, SUM(payments.amount))` — always recomputed

### Treatment tables

```
treatments             — Treatment plan items (root canal, crown, extraction)
                         Contains consent workflow columns:
                           consentStatus: PENDING | UPLOADED | VERIFIED | REJECTED | EMERGENCY_OVERRIDE
                           consentDocumentUrl: R2 URL of the uploaded form
                           consentDocumentName: original filename
                           consentUploadedAt: Unix timestamp
                           consentVerifiedAt: Unix timestamp (set when AI verifies or admin approves)
                           consentNotes: AI verification notes
                           emergencyOverride: 0 or 1
                           emergencyReason: text (required if override)
```

### Billing tables

```
invoices               — Standalone invoices (separate from visit billing)
invoiceTreatments      — Many-to-many: which treatments are on which invoice
```

### System tables

```
orgRoles               — Custom roles defined per organization
salaryRecords          — Monthly salary records per staff member
featureFlags           — Feature flag definitions + per-org overrides
verificationTokens     — OTP codes (EMAIL, PHONE) and staff invite tokens
rate_limits            — Rate limit counters (key, count, window_start)
```

### How to find a table's columns

Always check `src/db/schema.ts`. The column names there are the TypeScript names. The actual SQL column names use snake_case (Drizzle maps automatically).

---

## 5. The SUM Recompute Pattern

### The problem

Cloudflare D1 has no transactions. Suppose two receptionists record payments simultaneously:

```
Request A: reads paidAmount=0, totalAmount=500, due=500, sends amount=500
Request B: reads paidAmount=0, totalAmount=500, due=500, sends amount=500
Request A: INSERT payment(amount=500) ✓
Request B: INSERT payment(amount=500) ✓ — both inserts succeed
Request A: UPDATE visits SET paidAmount = paidAmount + 500 → paidAmount = 500
Request B: UPDATE visits SET paidAmount = paidAmount + 500 → paidAmount = 1000 (!!)
```

Or with the CASE guard approach (the old code):
```
Request A: UPDATE SET paidAmount = CASE WHEN 0+500<=500 THEN 500 ELSE 0 END → 500
Request B: UPDATE SET paidAmount = CASE WHEN 500+500<=500 THEN 1000 ELSE 500 END → stays 500
Result: 2 payment records (total ₹1000) but paidAmount=₹500 — accounting discrepancy
```

### The fix: recompute from source of truth

Instead of incrementing, recalculate the aggregate from the actual child rows:

```typescript
// After INSERT payment:
await db.update(visits).set({
  paidAmount: sql`MIN(total_amount, (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE visit_id = ${id}))`,
  updatedAt: Date.now(),
}).where(eq(visits.id, id));
```

Now even if two payments both insert, the SUM sees both records and the total is correct. And `MIN(total_amount, ...)` ensures we never exceed what's owed.

### Where this pattern is used

| Field | Recomputed after | Location |
|---|---|---|
| `visits.totalAmount` | Item add, item edit, item delete | `src/app/api/visits/[id]/items/` |
| `visits.paidAmount` | Payment add | `src/app/api/visits/[id]/payments/route.ts` |

### How to add it to a new feature

If you add a new aggregated field that is the sum of child records:

1. Never update it with `+= delta`
2. After any child insert/update/delete, run:
   ```typescript
   await db.update(parentTable).set({
     myAggregatedField: sql`(SELECT COALESCE(SUM(value_column), 0) FROM child_table WHERE parent_id = ${parentId})`,
     updatedAt: Date.now(),
   }).where(eq(parentTable.id, parentId));
   ```
3. The subquery executes atomically in a single SQL statement — this is safe without transactions.

---

## 6. RBAC Reference

Roles are stored in the `organizationMembers` table and carried in the `pkd_org_session` JWT as `session.role`.

### Role capabilities

| Feature | ADMIN | DOCTOR | NURSE | RECEPTIONIST | ATTENDANT | HELPER |
|---|---|---|---|---|---|---|
| View patients | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/edit patients | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete patients | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View PAN/Aadhaar | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create/view appointments | ✅ | Own only | ✅ | ✅ | ❌ | ❌ |
| Create visits | ✅ | Own only | ✅ | ✅ | ❌ | ❌ |
| Edit clinical notes | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View/create treatments | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reopen COMPLETED treatment | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Emergency consent override | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create payments | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create/view invoices | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Edit invoice paid amount | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Delete visits | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage staff | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage salary | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View org settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Where RBAC is enforced

**Server only.** The sidebar hides menu items by role, but that is cosmetic. All real enforcement happens in API route handlers:

```typescript
// Pattern 1: Restrict entire endpoint to specific roles
if (!["ADMIN", "RECEPTIONIST"].includes(session.role)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Pattern 2: DOCTOR sees only their own records
const doctorId = session.role === "DOCTOR" ? session.userId : searchParams.get("doctorId");

// Pattern 3: Restrict specific field update
if (session.role !== "ADMIN") {
  delete data.panNumber;
  delete data.aadhaarNumber;
}

// Pattern 4: Restrict specific status transitions
if (data.status === "PLANNED" && existingStatus === "COMPLETED" && session.role !== "ADMIN") {
  return NextResponse.json({ error: "Cannot reopen a completed treatment" }, { status: 422 });
}
```

---

## 7. How to Run a DB Migration

### Create a migration

```bash
# Create the file (replace 0015 with the next number)
touch drizzle/migrations/0015_add_notes_table.sql
```

Write valid SQLite DDL inside:

```sql
-- drizzle/migrations/0015_add_notes_table.sql
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  content TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_org ON notes(organization_id, created_at DESC);
```

Update `src/db/schema.ts` with the matching Drizzle table definition.

### Apply locally

```bash
npm run db:migrate
# Runs: wrangler d1 migrations apply parkkal-db --local
```

### Apply to production

```bash
npm run db:migrate:prod
# Runs: wrangler d1 migrations apply parkkal-db --remote
```

### Check which migrations have been applied

```bash
# Local
wrangler d1 execute parkkal-db --local --command="SELECT * FROM d1_migrations ORDER BY applied_at;"

# Production
wrangler d1 execute parkkal-db --remote --command="SELECT * FROM d1_migrations ORDER BY applied_at;"
```

### If a migration was applied manually (e.g. via Cloudflare console) but isn't tracked

```sql
INSERT INTO d1_migrations (name, applied_at)
VALUES ('0015_add_notes_table.sql', datetime('now'))
ON CONFLICT(name) DO NOTHING;
```

### SQLite DDL limitations

- SQLite supports `ADD COLUMN` but **not** `DROP COLUMN`, `RENAME COLUMN`, or `ALTER COLUMN` in older versions. If you need to change a column type, create a new column and migrate data.
- D1 has no transactional DDL. If a migration partially fails, you need to fix it manually. Test locally first.

---

## 8. Common Pitfalls

### ❌ Pitfall 1: Manual org check after fetch (the classic vulnerability)

```typescript
// WRONG — fetches from any org, then checks. If check has a bug, data leaks.
const [visit] = await db.select().from(visits).where(eq(visits.id, id));
if (visit.organizationId !== session.orgId) return 403;

// CORRECT — DB enforces org at the query level. If it returns nothing, access denied.
const [visit] = await db.select().from(visits)
  .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
if (!visit) return 404;
```

### ❌ Pitfall 2: Using Math.random() for IDs or codes

```typescript
// WRONG — Math.random() is not cryptographically secure
const id = Math.random().toString(36).slice(2);
const otp = Math.floor(100000 + Math.random() * 900000);

// CORRECT
const id = crypto.randomUUID();
const buf = new Uint32Array(1);
crypto.getRandomValues(buf);
const otp = String(100000 + (buf[0] % 900000));
```

### ❌ Pitfall 3: Trusting client-supplied doctorId or orgId

```typescript
// WRONG — attacker sends { doctorId: "some_other_doctor_id" }
const { doctorId } = await request.json();
await db.insert(appointments).values({ doctorId, organizationId: session.orgId, ... });

// CORRECT — DOCTOR role must be scoped to themselves
const doctorId = session.role === "DOCTOR" ? session.userId : parsed.data.doctorId;
```

### ❌ Pitfall 4: Calling getDb() at module scope

```typescript
// WRONG — throws "Cannot call getCloudflareContext() outside of a request"
const db = getDb();  // ← at the top of the file

export async function GET(request) { ... }

// CORRECT — call inside the handler
export async function GET(request) {
  const session = await getSession(request);
  const db = getDb();  // ← inside the function
  ...
}
```

### ❌ Pitfall 5: Exposing PHI to non-ADMIN roles

```typescript
// WRONG — returns panNumber and aadhaarNumber to any logged-in user
return NextResponse.json({ patient });

// CORRECT
const safePatient = session.role === "ADMIN"
  ? patient
  : { ...patient, panNumber: null, aadhaarNumber: null };
return NextResponse.json({ patient: safePatient });
```

### ❌ Pitfall 6: Using db.transaction() — it doesn't exist in D1

```typescript
// WRONG — D1 does not support transactions
await db.transaction(async (tx) => {
  await tx.insert(a).values(...);
  await tx.update(b).set(...);
});

// CORRECT — sequential awaits + SUM recompute
await db.insert(a).values(...);
await db.update(b).set({
  totalField: sql`(SELECT COALESCE(SUM(val), 0) FROM a WHERE parent_id = ${id})`,
}).where(eq(b.id, id));
```

### ❌ Pitfall 7: Missing Zod validation

```typescript
// WRONG — trusts raw JSON
const body = await request.json();
await db.insert(visits).values({ ...body, organizationId: session.orgId });

// CORRECT — always validate with Zod first
const parsed = createVisitSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
}
const { patientId, visitDate, ... } = parsed.data;
```

---

## 9. File Storage Pattern

All file storage goes through `src/lib/storage.ts`. In production it uses Cloudflare R2; in local dev it falls back to a `private_uploads/` directory.

### How to upload a file

```typescript
import { storeFile } from "@/lib/storage";

// Get the file from FormData
const formData = await request.formData();
const file = formData.get("file") as File | null;
if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

// Validate MIME type and size
const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "application/pdf": ".pdf" };
if (!ALLOWED[file.type]) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Too large" }, { status: 400 });

// Build a key with a UUID filename — never use the original filename as the key
const ext = ALLOWED[file.type];
const fileName = `${crypto.randomUUID()}${ext}`;
const key = `patients/${patientId}/${fileName}`;  // namespace by patient

const bytes = await file.arrayBuffer();
const { url } = await storeFile(key, bytes, file.type);

// Store the url in the database
await db.insert(attachments).values({ ..., fileUrl: url, fileName, originalName: file.name });
```

### Storage key conventions

| Content type | Key pattern | Example |
|---|---|---|
| Visit attachments | `patients/{patientId}/{uuid}{ext}` | `patients/abc123/def456.jpg` |
| Consent forms | `consents/{treatmentId}/{uuid}{ext}` | `consents/tx-001/xyz.pdf` |
| Org logos | `orgs/{orgId}/logo{ext}` | `orgs/org-1/logo.png` |

### How to serve a file

Files are served through `src/app/api/files/[...path]/route.ts`. This route:
1. Validates the session
2. Rejects path segments containing `..` or `/` (path traversal protection)
3. Fetches from R2 and streams the response with the correct `Content-Type`

Never serve R2 files with direct public URLs. Always go through this authenticated route.

---

## 10. Rate Limiting

Rate limiting is implemented in `src/lib/rate-limit.ts` using a D1-backed sliding window. In local dev it falls back to in-memory.

### How to add rate limiting to a new route

```typescript
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Always rate limit by IP first to prevent DoS
  const ip = getClientIp(request);
  const ipRl = await checkRateLimit(`my-feature-ip:${ip}`, {
    limit: 20,           // max 20 requests
    windowMs: 60 * 1000  // per 60 seconds
  });
  if (!ipRl.allowed) {
    const retryAfter = Math.ceil((ipRl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Optionally, also limit by user ID for finer control
  const session = await getSession(request);
  if (!session) return 401;

  const userRl = await checkRateLimit(`my-feature-user:${session.userId}`, {
    limit: 5,
    windowMs: 60 * 1000
  });
  if (!userRl.allowed) { ... }

  // ... rest of handler
}
```

### How `checkRateLimit` works

It uses a sliding window stored in the `rate_limits` D1 table:
- Key: any string you choose (e.g. `login:1.2.3.4`)
- Count: how many requests in the current window
- Window start: Unix timestamp of when the current window began

On each call: if the stored window has expired (window_start + windowMs < now), it resets to 1. Otherwise it increments. Returns `{ allowed: boolean, remaining: number, resetAt: number }`.

In local dev (no D1 binding): uses an in-memory `Map` with the same semantics.

---

## 11. Feature Flags

Feature flags let you deploy code behind a switch that can be toggled without redeploying.

### Check a flag in server code

```typescript
import { isFeatureEnabled } from "@/lib/flags";

// In a server component or API route:
const showNewBillingUI = await isFeatureEnabled("new-billing-ui", session.orgId);
if (showNewBillingUI) {
  // render new UI
}
```

### Check a flag in a client component

Fetch from the API on load:

```typescript
const [flags, setFlags] = useState<Record<string, boolean>>({});
useEffect(() => {
  fetch("/api/admin/flags").then(r => r.json()).then(d => {
    const map: Record<string, boolean> = {};
    (d.flags ?? []).forEach((f: { featureKey: string; isEnabled: boolean }) => {
      map[f.featureKey] = f.isEnabled === 1;
    });
    setFlags(map);
  });
}, []);

if (flags["new-billing-ui"]) { ... }
```

### Create a new flag

Insert a row into `feature_flags` in the D1 database:

```sql
INSERT INTO feature_flags (id, feature_key, name, description, org_id, is_enabled, rollout_percent, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'new-billing-ui',
  'New Billing UI',
  'Enables the redesigned billing tab on visit detail',
  NULL,          -- NULL = applies to all orgs; set an org_id to restrict to one org
  0,             -- 0 = disabled, 1 = enabled
  100,
  unixepoch() * 1000,
  unixepoch() * 1000
);
```

Toggle it via the `/dashboard/flags` UI (ADMIN only) or directly in D1.

---

## 12. How to Verify Your Changes Work

### Step 1: TypeScript check (mandatory)

```bash
npx tsc --noEmit
```

This must produce zero errors. If it fails, fix the errors before doing anything else.

### Step 2: Local dev server

```bash
npm run dev
```

Open `http://localhost:3000` and manually exercise the feature you changed. Test:
- The happy path (correct input, valid session)
- An invalid input (what does the error look like?)
- An unauthorized role (try the action as DOCTOR if you restricted to ADMIN)

### Step 3: Test the specific API route with curl

```bash
# Log in first to get a cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Call your new endpoint
curl -b cookies.txt http://localhost:3000/api/notes
```

### Step 4: Check for DB drift (financial routes)

If you changed anything in items, payments, or invoices:

```bash
# Check that totalAmount matches the sum of items
wrangler d1 execute parkkal-db --local --command="
SELECT v.id, v.total_amount, COALESCE(SUM(vi.amount), 0) as computed
FROM visits v
LEFT JOIN visit_items vi ON vi.visit_id = v.id
GROUP BY v.id
HAVING v.total_amount != computed;
"
```

An empty result means no drift. Any rows mean something is wrong.

### Step 5: Push to develop

```bash
git add <specific files>
git commit -m "feat: add notes endpoint with org-scoped pagination"
git push -u origin develop
```

---

## Quick Reference: Most-Read Files

When you need to understand something, start here:

| What you want to know | Where to look |
|---|---|
| All database tables and columns | `src/db/schema.ts` |
| JWT creation and session reading | `src/lib/auth-edge.ts` |
| How to get the D1 database | `src/lib/db.ts` |
| How to upload/read files | `src/lib/storage.ts` |
| Rate limit implementation | `src/lib/rate-limit.ts` |
| All nav items and role guards | `src/components/sidebar.tsx` |
| Visit detail page (most complex UI) | `src/app/dashboard/visits/[id]/page.tsx` |
| Consent upload + AI verify | `src/app/api/treatments/[id]/consent/upload/route.ts` |
| Payment POST (SUM recompute example) | `src/app/api/visits/[id]/payments/route.ts` |
| Signup flow (user + org creation) | `src/app/api/auth/signup/route.ts` |
| Middleware auth gate | `middleware.ts` |
