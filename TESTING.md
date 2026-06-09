# Testing Guide — Parkkal Dental

## Overview

| Layer | Tool | When |
|---|---|---|
| Unit / API route tests | Vitest | Every commit (CI auto) |
| E2E (browser) tests | Playwright | Every PR to `main` (CI auto) |
| Load / stress tests | k6 | Before each deployment (manual) |

---

## 1 — Unit & API Route Tests (Vitest)

### Run locally

```bash
# Run all tests once (same as CI)
npm test

# Watch mode (re-runs on file save — use during development)
npm run test:watch

# With coverage report (opens coverage/ folder)
npm run test:coverage
```

### Coverage thresholds

Coverage thresholds are enforced in `vitest.config.ts`. The build fails if any metric drops below:

| Metric | Threshold |
|---|---|
| Statements | 40% |
| Branches | 35% |
| Functions | 40% |
| Lines | 40% |

**Raise these 5 pts each sprint** as you add more test files.

### Test file locations

```
src/
  lib/__tests__/          ← Shared helpers + library tests
    helpers/db-mock.ts    ← makeDbMock() + NO_PARAMS helper
  app/api/__tests__/      ← API route tests (one file per route group)
    auth-login-route.test.ts
    auth-logout-route.test.ts
    appointments-route.test.ts
    patients-route.test.ts
    treatments-route.test.ts
    visits-route.test.ts
    payments-route.test.ts
    org-roles-route.test.ts
```

### Writing a new API route test

Key patterns (see existing files for full examples):

```ts
// 1. Mock dependencies at top level (hoisted by Vitest)
vi.mock("@/lib/db",    () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth",  () => ({ getSession: vi.fn(), isTokenRevoked: vi.fn().mockResolvedValue(false) }));

// 2. ADMIN sessions skip the member-active check — no extra DB slot needed
vi.mocked(getDb).mockReturnValue(makeDbMock([
  [{ total: 5 }],   // first query in handler
  [...rows],        // second query
]) as never);

// 3. Non-ADMIN sessions consume results[0] for the member-active check
vi.mocked(getDb).mockReturnValue(makeDbMock([
  [{ isActive: 1 }],  // member check (non-ADMIN)
  [{ total: 5 }],     // first handler query
  [...rows],
]) as never);

// 4. Always pass NO_PARAMS as second arg for non-parameterized routes
import { makeDbMock, NO_PARAMS } from "@/lib/__tests__/helpers/db-mock";
const res = await GET(new NextRequest("http://localhost/api/your-route"), NO_PARAMS);

// 5. For parameterized routes (e.g. /api/visits/[id]/payments)
const res = await GET(req, { params: Promise.resolve({ id: "v1" }) });
```

---

## 2 — E2E Tests (Playwright)

### Prerequisites

```bash
# 1. Install browsers (one-time)
npx playwright install chromium

# 2. Apply local DB migrations + seed test data
npm run db:migrate
npm run db:setup:local

# 3. Create a test admin user (if not already seeded)
# Set in environment:
export E2E_ADMIN_EMAIL=admin@parkkal.test
export E2E_ADMIN_PASSWORD=Admin1234
```

### Run E2E tests

```bash
# Run all E2E tests (starts dev server automatically)
npm run test:e2e

# Run headed (see the browser)
npm run test:e2e:headed

# Debug a specific test
npm run test:e2e:debug -- e2e/login.spec.ts

# View the HTML report from last run
npm run test:e2e:report
```

### E2E test files

```
e2e/
  auth.setup.ts       ← Logs in once, saves session → e2e/.auth/session.json
  login.spec.ts       ← Login flow, unauthenticated redirects
  patients.spec.ts    ← Patient list, create, search
  appointments.spec.ts← Appointment list, new form
  billing.spec.ts     ← Billing list, Reports page, sidebar navigation
```

### Adding a new E2E test

```ts
import { test, expect } from "@playwright/test";

// Shared auth session (admin) is loaded automatically from e2e/.auth/session.json
test("my feature works", async ({ page }) => {
  await page.goto("/dashboard/my-page");
  await expect(page.getByRole("heading", { name: /my heading/i })).toBeVisible();
  // ... interact and assert
});
```

### E2E in CI

E2E runs automatically on **PRs targeting `main`**. It requires:
- `E2E_ADMIN_EMAIL` secret set in GitHub
- `E2E_ADMIN_PASSWORD` secret set in GitHub
- `CLOUDFLARE_ACCOUNT_ID` (for `wrangler d1 migrate --local`)

---

## 3 — Load Tests (k6)

### Install k6

```bash
# macOS
brew install k6

# Check version
k6 version
```

### Get your auth cookie

1. `npm run dev` → open http://localhost:3000
2. Log in as admin
3. DevTools → Application → Cookies → copy `pkd_org_session` value
4. `export AUTH_COOKIE="pkd_org_session=<paste-value>"`

### Run load tests

```bash
export BASE_URL=http://localhost:3000   # or staging URL

# Smoke test (~30 seconds) — run BEFORE every deployment
npm run load:smoke

# API load test (~2 minutes) — run weekly or before releases
npm run load:api

# Spike test (~1 minute) — run before launch or adding a new clinic
npm run load:spike
```

### Thresholds (auto-enforced by k6)

| Metric | Threshold |
|---|---|
| Error rate | < 1% (< 5% during spike) |
| p95 response time | < 2 000 ms |
| p99 response time | < 5 000 ms |
| Reports endpoint p95 | < 3 000 ms |

k6 exits with code `1` if thresholds are breached — safe to use as a deployment gate.

---

## 4 — Pre-Deployment Checklist

Run these in order before every deployment:

```bash
# Step 1: Unit tests + type check + lint
npm test
npx tsc --noEmit
npx eslint src --max-warnings 0

# Step 2: Coverage (verify above thresholds)
npm run test:coverage

# Step 3: Smoke load test against local or staging
export BASE_URL=http://localhost:3000
export AUTH_COOKIE="pkd_org_session=<token>"
npm run load:smoke
# ✓ Expect: 0 HTTP errors, p95 < 2s

# Step 4: E2E tests against local
npm run test:e2e
# ✓ All browser journeys pass

# Step 5: Apply pending DB migrations to staging
npm run db:migrate:prod  # (only on staging, never skip)

# Step 6: Build the Cloudflare bundle
npm run cf:build
# ✓ No build errors
```

**Only proceed to Step 7 (deploy) if all 6 pass.**

---

## 5 — Post-Deployment Checklist

Run within 10 minutes of every deployment:

```bash
# Step 1: Smoke test against production
export BASE_URL=https://your-app.workers.dev
export AUTH_COOKIE="pkd_org_session=<prod-token>"
npm run load:smoke
# ✓ Expect: 0 errors, all routes respond 200

# Step 2: Check the App Logs viewer for errors
# → Login → Settings → App Logs
# → Filter: Level = Error, Last 1 hour
# ✓ Expect: no new errors after deployment time

# Step 3: Verify critical user journey manually (< 5 min)
# a) Log in as admin
# b) Create or search a patient
# c) Book an appointment
# d) Open Reports page → check it loads
# e) Log out → verify redirect to /login
```

**If smoke test fails or App Logs shows errors → rollback:**

```bash
# Redeploy the previous version from GitHub Actions:
# Actions → deploy.yml → previous successful run → Re-run jobs
```

---

## 6 — Common Test Failures & Fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot read properties of undefined (reading 'params')` | Route called without context | Pass `NO_PARAMS` as 2nd arg |
| `Expected 1 arguments, but got 2` | Route is a plain `async function`, not `withRoute` | Remove the `NO_PARAMS` arg |
| DB mock results off by one | ADMIN vs non-ADMIN `getDb()` call order | ADMIN: no `[{ isActive: 1 }]` slot. Non-ADMIN: add it at results[0] |
| `mock.toHaveBeenCalled` counting previous tests | Mock not cleared between tests | Add `vi.mocked(fn).mockClear()` in `beforeEach` |
| E2E: element not found | Selector mismatch after UI change | Update selector to match new DOM (use `--headed` to debug) |
| Load test threshold breach | DB query slow under load | Add index, or check D1 query via `db:studio` |

---

## 7 — Coverage Roadmap

Current test files cover ~40% of API routes. Priority order for new tests:

| File to add | Routes covered | Priority |
|---|---|---|
| `org-members-route.test.ts` | GET/POST /api/org/members | P1 |
| `visit-items-route.test.ts` | GET/POST/DELETE /api/visits/[id]/items | P1 |
| `invoices-route.test.ts` | GET/POST /api/invoices | P1 |
| `recalls-route.test.ts` | GET/POST /api/recalls | P2 |
| `reports-route.test.ts` | GET /api/reports | P2 |
| `dashboard-stats-route.test.ts` | GET /api/dashboard/stats | P2 |
