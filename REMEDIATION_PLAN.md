# Parkkal — Phased Remediation Plan

> Generated: 2026-06-17
> Scope: Individual clinics + Multi-branch hospitals (full multi-tenancy, org-level isolation)
> Exclusions: WhatsApp, SMS, AI integrations

---

## Corrections to Initial Review

Several items flagged as missing actually exist and were undiscovered during the initial review:

| Item | Status |
|------|--------|
| Calendar page (month/week/day) | ✅ EXISTS — `/dashboard/appointments/calendar` |
| Onboarding checklist | ✅ EXISTS — 5-step wizard on dashboard, `onboarding_dismissed_at` in DB |
| Toast notification system | ✅ EXISTS — `src/context/toast-context.tsx` |
| Appointment reminders (email) | ✅ EXISTS and WIRED — reminder-scheduler + cron every 15 min |
| Stripe webhook signature verification | ✅ EXISTS — `verifyStripeSignature()` in webhooks/stripe |
| JWT token revocation | ✅ EXISTS — `revokeToken()` in `src/lib/auth-edge.ts` |

Corrected scores used in the projection table at the end of this document.

---

## Phase 0 — Critical Bugs (Do Before First Paying Customer)

*Estimated effort: 3–5 days. These are production time-bombs.*

| # | Problem | What to Build | Location |
|---|---------|---------------|----------|
| P0-1 | **Duplicate migration 0048** — both `0048_org_timezone.sql` and `0048_tooth_condition_history.sql` exist. File-system ordering determines which ran on a fresh DB. | Renumber `0048_tooth_condition_history.sql` → `0053_tooth_condition_history.sql`. Verify `setup-local-db.js` applies both correctly. | `drizzle/migrations/` |
| P0-2 | **Role change does not invalidate existing JWT** — `revokeToken()` exists but the role-change PATCH handler may not call it. A demoted or fired staff member retains access until natural token expiry. | In the role-change PATCH route: fetch the user's `jti` from DB, call `revokeToken(jti, tokenExpiresAt)`. Same on staff deactivation. | `src/app/api/org/members/[id]/route.ts` |
| P0-3 | **Toast not wired to visit actions** — toast context exists but add-payment / add-item / complete-visit on the visit detail page uses inline error state only, with no success feedback. | Wrap all success paths in visit page with `toast.success(...)` messages. | `src/app/dashboard/visits/[id]/page.tsx` |
| P0-4 | **File upload MIME/size validation is client-side only** — R2 uploads for consent documents and photos need server-side checks. | In `src/lib/storage.ts` and the attachments/photos API routes: validate `Content-Type` and file size before calling R2 `put()`. Reject non-image/PDF MIME types. | `src/lib/storage.ts`, `src/app/api/visits/[id]/attachments/` |
| P0-5 | **Superadmin routes have no MFA** — `SUPERADMIN` role is a JWT claim; a compromised signing key gives global access to every org's data. | Add a time-limited `superadmin_session` token signed with a separate `SUPERADMIN_SECRET` env var, required as a second header on all `/api/superadmin/` routes. Log every superadmin action to a separate append-only table. | `src/app/api/superadmin/`, `src/lib/auth-edge.ts` |

---

## Phase 1 — UI Polish & Navigation (1–2 weeks)

*Addresses: UI 7→9, UX 6→8, User Friction 6→8*

| # | Problem | What to Build |
|---|---------|---------------|
| 1-1 | **Dark mode configured but no CSS variables** — `tailwind.config.ts` has `darkMode: "class"` but `globals.css` has 0 `dark:` overrides. | Add a full dark colour palette to `globals.css` under `.dark {}` — remap every `--pk-*` token to a dark-appropriate value. Add a dark mode toggle (sun/moon icon) in the header, persisted to `localStorage`. |
| 1-2 | **Sidebar has no visual hierarchy** — 12 items at equal weight, same nav for doctor and receptionist. | Group into 3 sections: **Clinical** (Patients, Visits, Treatments, Appointments, Recalls), **Finance** (Billing, Invoices, Salary), **Admin** (Staff, Roles, Reports, Settings). Collapse Finance and Admin by default for DOCTOR role. |
| 1-3 | **No global search / command palette** | Build a `CommandPalette` component (Cmd+K / Ctrl+K). Searches patients by name or phone, visits by ID, opens quickly to any page. Backed by `GET /api/patients?search=` and `GET /api/visits?search=`. Add a search icon in the header as a secondary trigger. |
| 1-4 | **Browser `confirm()` dialogs throughout** (unlink treatment, delete template, etc.) | Replace every `confirm(...)` with a small reusable `ConfirmModal` component that matches the design system. Props: `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`. |
| 1-5 | **No keyboard shortcuts** | Add a `useKeyboardShortcuts` hook. Minimum viable set: `K` = command palette, `N` = new patient (from patients page), `/` = focus search on list pages, `Esc` = close modal. Document them in a `?` help popover in the header. |
| 1-6 | **Mobile: visit detail tabs overflow and tooth chart clips** | On viewports below `md`: collapse visit detail tabs into a `<select>` dropdown. Make the ToothChart SVG scroll horizontally. `CompleteVisitModal` and `LinkSuggestBar` need `max-h-screen overflow-y-auto`. |
| 1-7 | **Consent 🔒 badge has no guidance path** | Replace the static lock span with a button that scrolls to the Treatment Plan tab and opens the consent upload section, with a tooltip: "Upload a signed consent form or apply Emergency Override to enable billing." |

---

## Phase 2 — Clinical Workflow Depth (3–4 weeks)

*Addresses: User Friction 8→9, Doctor/Receptionist 7→9, Senior PM 7→9*

| # | Problem | What to Build |
|---|---------|---------------|
| 2-1 | **8 tabs in visit detail is too many** | Merge **Photos** + **Attachments** → single "Files" tab. Merge **History** into a collapsible section at the bottom of the Items tab (it's read-only reference data). Result: 6 tabs — Items, Payments, Files, Prescriptions, Treatment Plan, Dental Chart. |
| 2-2 | **No inline payment from items tab** | Below the items list on the Items tab, add a quick-pay row: amount input + method selector + "Record Payment" button. This covers the 80% receptionist case — add item, collect cash, done. Keep the full Payments tab for history and advance payments. |
| 2-3 | **No receipt after payment** | After a payment is recorded, show a "Print Receipt" button that opens `GET /api/visits/[id]/receipt` — a server-rendered HTML page with org logo, patient name, items, amount paid, method, and date. Use `window.print()`. No external library needed. |
| 2-4 | **Tooth chart multi-select friction** | Add quadrant quick-select buttons above the chart (UL / UR / LL / LR) that toggle all 8 teeth in that quadrant. Add "All Upper" / "All Lower" toggles for full-arch work. Per-tooth click still works. |
| 2-5 | **Recall is a dead-end list** | Add an action column: "Book Appointment" → pre-fills new appointment with `recallVisitId` (already supported in the API). After booking, show "Booked" with a link to the appointment. After the appointment completes, auto-close the recall via `PATCH /api/recalls/[id]` with `status: "COMPLETED"`. |
| 2-6 | **Prescription: org_drugs table exists but UI is minimal** | Surface the org_drugs list as a searchable datalist on the drug name field. Add dosage frequency presets (OD, BD, TDS, QDS, SOS) as quick-select chips instead of free text. Verify `Settings → Drugs` management page is complete. |
| 2-7 | **No appointment → visit auto-create** | When a receptionist marks an appointment as IN_PROGRESS, offer "Create Visit for this appointment" if no visit exists yet. Pre-fills patient, doctor, chief complaint from appointment notes. |
| 2-8 | **Reports show metrics, not insights** | Add three insight cards: (a) "Missed revenue from no-shows: ₹X in period" (b) "Outstanding treatment balance: ₹X across N patients" (c) "Top 5 patients by outstanding balance." All computable from existing schema data. |

---

## Phase 3 — Data Operations & Business Tools (3–4 weeks)

*Addresses: Sales Engineering 5→8, Customer Support 5→9, Admin 7→9*

| # | Problem | What to Build |
|---|---------|---------------|
| 3-1 | **No data import — the #1 sales objection** | Build a CSV import wizard for patients. Step 1: Download template CSV (name, phone, email, dob, gender, blood_group, medical_notes). Step 2: Upload CSV, parse client-side, show preview table with validation errors highlighted. Step 3: Confirm → `POST /api/patients/import` batch-inserts in transactions of 100. Show progress. Max 1000 patients per import. |
| 3-2 | **No bulk operations** | On the Appointments list: multi-select checkbox + "Mark as Completed" / "Mark as No-Show" action bar (shown only when rows are selected). On the Patients list: multi-select + "Export selected" CSV. Limit to 50 records per bulk operation. |
| 3-3 | **No demo / sandbox environment** | Add `POST /api/internal/seed-demo` (gated by `INTERNAL_SECRET` header, disabled in production) that inserts: 1 org, 3 staff (admin/doctor/receptionist), 10 patients, 20 visits, 15 treatments, 30 appointments with realistic dates. Add `scripts/seed-demo.js`. Staging runs this on demand for demos. |
| 3-4 | **No OpenAPI documentation** | Add `GET /api/openapi.json` that returns a hand-authored OpenAPI 3.0 spec covering all public endpoints. Serve Swagger UI at `/api/docs`. Generate a Postman collection from the spec. This is the enterprise integration enabler. |
| 3-5 | **No in-app help** | Add a `?` icon in the header that opens a help panel: searchable list of common tasks ("How do I record a payment?", "What is Emergency Override?") with 3–5 sentence answers. Static content, no external dependency. |
| 3-6 | **Quick patient search by phone** | Command palette (Phase 1-3) and the top-bar search input must support phone number queries, not just name. Receptionists identify patients by phone number more often than by name. |

---

## Phase 4 — Multi-Branch / Enterprise (6–8 weeks)

*The largest architectural addition. Addresses: Principal PM 6→9, Eng Manager 6→8, multi-branch market.*

### Architectural Model

```
Org (Hospital Group / Clinic Owner)
  └── Location A (Main Branch)   ← visits, appointments, staff assignments
  └── Location B (Second Branch) ← visits, appointments, staff assignments

Patient records, tooth chart, treatment plans → ORG-SCOPED (visible at all branches)
Visits, appointments, staff assignments → LOCATION-SCOPED
```

Security boundary remains at org level. Location is a filter, not a tenant.

### 4A — Schema (migrations 0053–0057)

| Migration | Change |
|-----------|--------|
| `0053_locations.sql` | New table: `locations (id, organization_id, name, address, phone, timezone, is_active, created_at)` |
| `0054_location_fks.sql` | Add `location_id` (nullable FK to locations) to `visits` and `appointments` |
| `0055_staff_location_assignments.sql` | New table: `staff_location_assignments (id, user_id, organization_id, location_id, is_primary, created_at)` — a doctor can work at multiple branches |
| `0056_location_settings.sql` | New table: `location_settings (location_id, opening_time, closing_time, slot_duration_minutes, max_advance_booking_days)` — per-branch schedule config |
| `0057_backfill_default_location.sql` | Insert one default location per org from existing org address/phone. Set `location_id` on all existing visits and appointments to that default. |

> **Note:** Resolve the duplicate `0048` migration (Phase 0, item P0-1) before these migration numbers are assigned.

### 4B — API Changes

| Route | Change |
|-------|--------|
| `GET /api/locations` | List all locations for the org |
| `POST /api/locations` | Create branch (ADMIN only) |
| `PATCH /api/locations/[id]` | Edit branch name, address, phone, hours |
| `DELETE /api/locations/[id]` | Soft-delete (set `is_active = 0`) |
| `GET /api/visits` | Add `locationId` filter |
| `POST /api/visits` | Accept optional `locationId`; default to org's primary location |
| `GET /api/appointments` | Add `locationId` filter |
| `POST /api/appointments` | Accept `locationId`; validate doctor is assigned to that location |
| `GET /api/reports` | Add `locationId` filter; add `consolidated=true` aggregate across all locations |
| `GET /api/staff` | Add `locationId` filter — returns doctors available at a branch |

### 4C — UI Changes

| Component | Change |
|-----------|--------|
| Header | Add location selector dropdown (visible only if org has >1 location). Selected location stored in context + cookie. All list pages filter by selected location. "All Locations" option for ADMIN consolidated view. |
| Dashboard | Location-aware stats. ADMIN sees all-location aggregate + per-location breakdown cards. |
| Appointments calendar | Per-location calendar. Doctor dropdown shows only doctors assigned to selected location. |
| Reports | Add "Location" filter dropdown. Exported CSV includes location column. |
| Settings | New **Locations** tab: add/edit/deactivate branches, set opening hours, assign doctors to branches. |
| Staff management | Show "Assigned Locations" on staff profile. Multi-select assignment. |

### 4D — Cross-Branch Patient Continuity

A patient who visits Branch A and then Branch B must have their full history visible at Branch B. This requires **no schema changes** because:

- Patient records, tooth chart, treatment plans — already org-scoped ✅
- Visit history filtered by `patientId` — org-wide, just show location name in history ✅
- Treatment plan tab — already shows all org-wide plans for the patient ✅
- Patient search when booking at Branch B — already org-wide ✅

Only UI change needed: show the location name column in visit history and appointment lists.

---

## Phase 5 — Security Hardening (3–4 weeks)

*Addresses: Security Architect 7→10, CISO 5→9*

| # | Problem | What to Build |
|---|---------|---------------|
| 5-1 | **Encryption key has no rotation strategy** — one `ENCRYPTION_KEY`, no versioning. If compromised, all PII is exposed indefinitely. | Add `ENCRYPTION_KEY_V2` env var. Prefix encrypted values with a version tag (`v1:...`, `v2:...`). `decrypt()` reads the prefix and uses the matching key. `encrypt()` always uses the latest version. Write `scripts/rotate-encryption-key.js` that decrypts all PII fields and re-encrypts with v2. |
| 5-2 | **Audit log is mutable** — stored in D1 alongside patient data; a DB-level attacker can alter it silently. | Add `audit_log_hash` column: each row stores `SHA-256(previous_row_hash + current_row_JSON)` — a simple hash chain. Add `GET /api/admin/audit-log/verify` that walks the chain and reports any broken link. Tamper becomes detectable without moving the log off D1. |
| 5-3 | **DPDP patient consent captured in schema but not in UI** — migration 0044 added `data_consent_at` / `data_consent_ip` but they may not be collected. | On patient registration: add a required "Patient consents to digital health record processing" checkbox. Record `data_consent_at = Date.now()` and `data_consent_ip` from request. Show consent status on patient profile. Add a "Withdraw Consent" action per DPDP Article 13 (marks record for deletion). |
| 5-4 | **No explicit CORS policy** | In middleware or a Cloudflare Worker layer: set `Access-Control-Allow-Origin` to the app's own domain only. Reject preflight requests from unknown origins. |
| 5-5 | **Missing security response headers** | Add middleware that sets: `Strict-Transport-Security: max-age=63072000`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Wire up the existing `/api/csp-report` endpoint to a default `Content-Security-Policy` header. |
| 5-6 | **Emergency override has no admin notification** | After `POST /api/treatments/[id]/consent/override`: send an email via Resend to all ADMIN-role users in the org — "Emergency consent override applied for [treatment] by [doctor] — Reason: [...]." Log to audit log with `severity: "HIGH"`. |
| 5-7 | **Data residency is undocumented** | Add `data_region` to org settings (informational field). Update the DPA template to document current state: D1 data is globally replicated by default. Commit to migrating to a Cloudflare India region when available. This is the honest answer for DPDP compliance conversations. |
| 5-8 | **Third-party penetration test** | Not code — process. Before onboarding enterprise or multi-branch hospital customers, engage a CERT-In empanelled security auditor for a black-box pentest. Required for any government hospital empanelment. Budget: ₹1.5–3L. |

---

## Phase 6 — GTM Enablement (3–4 weeks)

*Addresses: CMO 3→9, Sales Engineering 5→10, Customer Support 5→10*

| # | Problem | What to Build |
|---|---------|---------------|
| 6-1 | **No product website** | Separate Next.js marketing site (same brand tokens). Core pages: Home (consent-gate-to-billing hero), Features, Pricing, About, Contact. One CTA: "Start free 30-day trial." Outside this repo. |
| 6-2 | **No free trial flow in the UI** | Subscription plans and Stripe are already wired. Add: 30-day free trial on signup (`trialEndsAt` on org, skip subscription check during trial). Show a trial countdown banner in the header: "12 days left in your trial — Upgrade." |
| 6-3 | **No demo environment** | Phase 3-3 builds the seed script. Additionally: `demo.parkkal.app` worker that auto-seeds on first visit (detected by empty patient count) and shows "This is a demo — data resets every 24 hours." |
| 6-4 | **No contextual help** | Add a `?` icon in the header opening a help panel (Phase 3-5). Additionally: add `InfoTooltip` components on Emergency Override, Consent status badge, ProgressRing, "Link Only" vs "Link & Add to Bill", and Session notes field. |
| 6-5 | **No API documentation for integrations** | Phase 3-4 builds the OpenAPI spec and Swagger UI. Generate a Postman collection from the spec. This answers the "can it connect to Tally/QuickBooks?" question in enterprise sales. |
| 6-6 | **No knowledge base** | Add static `/help/[topic]` MDX pages linked from each major dashboard page ("Learn how treatment plans work →"). Initial set: treatment-plans, consent-management, billing, recalls, reports. No external dependency. |

---

## Phased Score Projection

| Dimension | Now (Corrected) | After P0+1 | After 2–3 | After 4–5 | After 6 |
|-----------|:-:|:-:|:-:|:-:|:-:|
| User Friction | 6 | 8 | 9 | 9 | 10 |
| Novelty | 8 | 8 | 9 | 10 | 10 |
| UI | 7 | 9 | 9 | 9 | 10 |
| UX | 6 | 8 | 9 | 9 | 10 |
| Doctor | 8 | 8 | 9 | 10 | 10 |
| Admin | 7 | 8 | 9 | 10 | 10 |
| Receptionist | 7 | 8 | 9 | 10 | 10 |
| Senior Dev | 8 | 9 | 9 | 9 | 10 |
| Eng Manager | 6 | 7 | 8 | 9 | 10 |
| Senior PM | 7 | 8 | 9 | 9 | 10 |
| Principal PM | 6 | 6 | 7 | 9 | 10 |
| Security Architect | 7 | 8 | 8 | 10 | 10 |
| CISO | 5 | 6 | 7 | 9 | 10 |
| CMO | 3 | 3 | 4 | 4 | 9 |
| Sales Engineering | 5 | 6 | 8 | 8 | 10 |
| Customer Support | 5 | 7 | 9 | 9 | 10 |
| CEO | 7 | 8 | 8 | 9 | 10 |

---

## Dependency Order

```
Phase 0 (critical bugs — must fix first)
  └── Phase 1 (UI/navigation foundation)
        └── Phase 2 (clinical workflows — needs solid navigation to be usable)
              └── Phase 3 (data operations — needs working workflows first)
                    ├── Phase 4 (multi-branch — needs stable schema; design locations
                    │           BEFORE Phase 3 import so import is location-aware)
                    └── Phase 5 (security — can run in parallel with Phase 4)
                          └── Phase 6 (GTM — only after product is solid)
```

**Critical sequencing note:** The `locations` schema (Phase 4) must be designed and migration-locked before the data import wizard (Phase 3) is built. Do not build import as org-only and retrofit location tagging later — that is a painful backfill across potentially thousands of patient records.

---

## Effort Summary

| Phase | Scope | Solo dev estimate |
|-------|-------|:-:|
| Phase 0 | Critical bug fixes | 3–5 days |
| Phase 1 | UI polish + navigation | 2 weeks |
| Phase 2 | Clinical workflow depth | 4 weeks |
| Phase 3 | Data operations + business tools | 3 weeks |
| Phase 4 | Multi-branch / enterprise | 6–8 weeks |
| Phase 5 | Security hardening | 3 weeks |
| Phase 6 | GTM enablement | 3 weeks |
| **Total** | | **~25–30 weeks** |

CMO score does not reach 10/10 until Phase 6 because it requires an external marketing site — design, copywriting, and brand execution, not just engineering. Everything else is buildable within the existing codebase architecture without introducing new frameworks or dependencies.
