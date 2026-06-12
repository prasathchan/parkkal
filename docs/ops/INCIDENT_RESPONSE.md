# Incident Response Runbook

Audience: whoever is on call (currently: founder). Goal: restore service safely,
preserve evidence, communicate honestly.

## Severity levels

| Sev | Definition | Examples | Target response |
|-----|-----------|----------|-----------------|
| 1 | Data breach or data loss | PHI exposed, wrong-tenant data visible, retention cron misfire | Immediate, drop everything |
| 2 | Service down / writes failing | Worker 5xx storm, D1 unavailable, login broken | < 1 hour |
| 3 | Degraded feature | Email/SMS not sending, reports slow, one page broken | Same day |
| 4 | Cosmetic / single user | UI glitch, one clinic's config issue | Next release |

## First 15 minutes (any Sev 1–2)

1. **Look**: `npx wrangler tail parkkal-dental` and Settings → App Logs.
2. **Recent deploy?** `gh run list --limit 5`. If the incident started right
   after a deploy: `npx wrangler rollback` first, investigate second.
3. **Capture evidence** before fixing: copy tail output, screenshot logs,
   note timestamps (UTC). Needed for the post-mortem and any DPDP breach
   assessment.
4. **Don't run destructive commands under pressure.** No deletes, no
   production migrations, no `wrangler d1 execute` writes during an incident.

## Sev 1 — suspected data breach (PHI exposure / cross-tenant leak)

1. If actively leaking: take the surface offline — disable the route via a
   hotfix deploy, or in the worst case `npx wrangler delete` the worker
   (clinics lose access; data in D1/R2 is untouched).
2. Preserve: audit log (`admin_audit_log`), app logs, request logs. Do not
   truncate or "clean up" anything.
3. Identify scope: which orgs, which patients (by ID), what fields, what
   time window.
4. Legal duties: DPDP Act 2023 requires notifying the Data Protection Board
   of India and affected Data Principals of personal-data breaches. Timelines
   and format are prescribed by the DPDP Rules — engage counsel immediately;
   see docs/legal/LEGAL_REVIEW_REQUIRED.md item 4.
5. Post-incident: rotate `JWT_SECRET` (forces re-login), rotate
   `INTERNAL_API_KEY` pair, review `ENCRYPTION_KEY` exposure (rotation
   requires a re-encryption job — do not rotate blindly; old data becomes
   unreadable).

## Sev 2 — service down

- 5xx storm right after deploy → `npx wrangler rollback`.
- D1 errors → check Cloudflare status page first; D1 outages are not fixable
  from our side. Post a status notice to clinics if > 30 min.
- Login broken but reads fine → check `JWT_SECRET` secret presence,
  `revoked_tokens` growth, and rate-limiter table.

## Communications

- Single owner: Prasath (chandran.aathi@live.in).
- Clinics are notified by email (Resend) for Sev 1–2 lasting > 1 hour.
- Never name affected patients in any communication or log.

## Post-mortem (within 48 h of any Sev 1–2)

Write to `docs/ops/postmortems/YYYY-MM-DD-<slug>.md`: timeline, root cause,
blast radius, what limited it, action items with owners.
