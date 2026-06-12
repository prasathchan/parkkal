# DPDP / Healthcare-SaaS Compliance Readiness

Status of Parkkal against India's Digital Personal Data Protection Act 2023
(DPDP) and general healthcare-SaaS expectations. ✅ implemented in code ·
📄 documented/process · ⚠️ requires human/legal action (tracked in
docs/legal/LEGAL_REVIEW_REQUIRED.md).

## Data inventory

| Data | Where | Protection |
|------|-------|-----------|
| Patient identity (name, phone, DOB, gender, address) | `patients` (D1) | Tenant-scoped; never logged |
| PAN / Aadhaar | `patients` | AES-256-GCM via `lib/encryption.ts`; masked (`null`) in list APIs |
| Clinical data (visits, tooth chart, prescriptions, notes) | `visits`, `tooth_chart`, … | Tenant-scoped; never logged |
| Attachments (X-rays, reports) | R2 | Access via authed routes only |
| Staff identity | `users`, `organization_members` | Tenant-scoped |
| Audit trail | `admin_audit_log`, `consent_audit_log` | Append-only by convention |

## Control status

| Control | Status | Where |
|---------|--------|-------|
| Consent at registration | ✅ | `dataConsent: z.literal(true)` in patient schema; recorded in `consent_audit_log` |
| DPA acceptance tracking | ✅ | `/accept-dpa` flow + org-level acceptance fields |
| Data retention enforcement | ✅ | `organizations.dataRetentionYears` + daily 02:00 UTC purge cron (`/api/cron/retention`), each purge audited |
| Data export (portability) | ✅ | `GET /api/export?type=patients|visits|treatments` (CSV, permission-gated) |
| Data deletion on request | ✅/📄 | Per-patient cascade delete exists (admin, audited). Org-wide offboarding: run retention with years=0 — process doc below |
| Audit trail for sensitive ops | ✅ | `writeAuditLog()` on deletes, role changes, billing, retention purges, console activations |
| PII encryption at rest | ✅ | AES-256-GCM for PAN/Aadhaar; D1/R2 encrypted at rest by Cloudflare |
| PHI logging ban | ✅/📄 | Policy: log IDs only — enforced by review; see "PHI logging policy" below |
| Breach response | 📄 | docs/ops/INCIDENT_RESPONSE.md Sev 1 section |
| Privacy notice | ⚠️ | Draft exists outside repo (`legal/privacy/`) — needs legal review + a public `/legal/privacy` page |
| Subprocessor list | 📄 | Below |
| Access reviews | 📄 | Checklist below |
| Consent manager / DPB registration duties | ⚠️ | Depends on Significant Data Fiduciary classification — legal question |

## Subprocessors

| Vendor | Purpose | Data touched | Region |
|--------|---------|--------------|--------|
| Cloudflare (Workers, D1, R2) | Hosting, DB, file storage | All app data | Global edge; data at rest per CF jurisdiction settings |
| Resend | Transactional email | Staff emails, patient emails on receipts/reminders | US/EU |
| Twilio | SMS / WhatsApp | Patient phone numbers, appointment times | US |
| Stripe | Subscription payments (clinic-level, not patient) | Clinic billing details | US/IN |
| GitHub | Source code, CI | No patient data | US |

⚠️ DPAs with each vendor must be on file — legal item 2.

## PHI logging policy

- Never log: patient name, phone, DOB, address, PAN, Aadhaar, clinical notes,
  prescription contents, attachment contents/filenames.
- Allowed: opaque IDs (`patientId`, `visitId`), org IDs, counts, durations.
- `lib/logger.ts` is the only logging path; structured fields only.
- CI/code review enforces this; a violation in production logs is a Sev 1.

## Patient rights request workflow (manual until self-serve)

1. Patient contacts their clinic (Parkkal is processor; the clinic is the
   fiduciary interface).
2. Clinic admin actions in dashboard: export (CSV) / correct (edit) /
   delete (cascade delete, audited).
3. If a clinic asks Parkkal directly: verify the requester is an org admin,
   act within 7 days, record in the audit log.

## Access review checklist (quarterly)

- [ ] List all org admins per clinic — confirm with clinic owner
- [ ] Review superadmin panel access (should be: founder only)
- [ ] Review Pricing Console users (`internal_users.is_active`) — deactivate leavers
- [ ] Rotate `CRON_SECRET`, review `INTERNAL_API_KEY` age
- [ ] Check Cloudflare account members + API token scopes
- [ ] Review GitHub repo collaborators
