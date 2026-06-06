# Contributing to Parkkal

This guide answers: **"How do I make a change without breaking anything?"**

---

## Before you start

1. Read `ARCHITECTURE.md` — understand where things live
2. Run the test suite and confirm it passes: `npx vitest run`
3. Start the dev server: `npm run dev`

---

## The golden rules

1. **Every API route must have auth + permission checks** — no exceptions
2. **Never store plain-text PAN or Aadhaar** — use `encryptField()` / `decryptField()`
3. **Never print patient data** in logs or error messages
4. **Validate all inputs with Zod** before touching the database
5. **Write tests** for any new logic in `src/lib/` (see `src/lib/__tests__/`)
6. **Run `npx tsc --noEmit` before committing** — zero type errors required

---

## Making a change — checklist

Before opening a pull request or deploying:

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx eslint src --max-warnings 0` → 0 warnings
- [ ] `npx vitest run` → all tests pass
- [ ] New API routes have auth + permission checks
- [ ] New columns have a migration file in `drizzle/migrations/`
- [ ] New types are in `src/types/`
- [ ] New magic strings are in `src/constants/`
- [ ] New fetch calls use `src/api/` (not raw `fetch()` in the page)

---

## File naming

| What | Convention | Example |
|------|-----------|---------|
| React components | kebab-case.tsx | `visit-items-tab.tsx` |
| Utility functions | kebab-case.ts | `billing.ts` |
| Constants | kebab-case.ts | `visit.ts` |
| Types | kebab-case.ts | `patient.ts` |
| API routes | `route.ts` (Next.js standard) | `src/app/api/visits/route.ts` |
| Migrations | `NNNN_description.sql` | `0027_patient_allergies.sql` |

---

## Commit messages

Use this format:
```
Short description of what changed (under 60 chars)

Longer explanation if needed. Why was this change made?
What problem does it solve? Any gotchas?
```

Examples:
- `Add allergies field to patient profile`
- `Fix: treatment delete now blocked when billed items exist`
- `Refactor: move billing status logic to lib/billing.ts`

---

## Writing tests

Tests live in `src/lib/__tests__/`. Use Vitest.

```ts
import { describe, it, expect } from "vitest";
import { getBillingStatus } from "@/lib/billing";

describe("getBillingStatus", () => {
  it("returns PAID for a free visit (₹0 total)", () => {
    expect(getBillingStatus(0, 0)).toBe("PAID");
  });

  it("returns PENDING when nothing has been paid", () => {
    expect(getBillingStatus(1000, 0)).toBe("PENDING");
  });
});
```

Run with: `npx vitest run`

---

## Getting help

- Read the file's top comment — every file explains what it does
- Check `ARCHITECTURE.md` for the big picture
- Search the codebase for an existing example of what you're trying to do
