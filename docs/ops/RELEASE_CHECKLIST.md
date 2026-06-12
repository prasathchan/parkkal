# Production Release Checklist

Every production release of the Parkkal main app MUST follow this list in order.
The same sequence applies to the Pricing Console (swap repo paths).

## Before merging

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm test` — all green
- [ ] `npx eslint src --max-warnings 0` — 0 warnings
- [ ] `npm run build` — clean
- [ ] New DB migration? → applied locally via `node scripts/setup-local-db.js`, tests pass on fresh DB
- [ ] New env var? → added to `src/lib/env.ts`, `.env.example`, and set as a Cloudflare secret in **both** staging and prod
- [ ] No PHI in any new log statement (names, phone, DOB, PAN, Aadhaar, clinical notes — IDs only)
- [ ] New routes use `withRoute()` (or are documented public/webhook/cron/internal exceptions)

## Deploy sequence (NO EXCEPTIONS)

1. [ ] `git push origin main:staging`
2. [ ] Wait for staging CI: `gh run list --branch staging --limit 3` → `completed success`
3. [ ] Smoke-test staging worker (login + one read endpoint)
4. [ ] `git push origin main`
5. [ ] Wait for prod deploy workflow green
6. [ ] Smoke-test production: login, `/api/cron/health` returns `{"status":"ok"}`

## After deploy

- [ ] Watch `npx wrangler tail parkkal-dental` for 5 minutes — no new errors
- [ ] Check Settings → App Logs in the dashboard for error/security spikes
- [ ] If a migration ran: verify with `npx wrangler d1 migrations list parkkal-db --remote`

## Rollback

See `/Users/prasathchan/Documents/parkkal/ops/runbooks/ROLLBACK.md` and
`docs/ops/INCIDENT_RESPONSE.md`. Key facts:

- Workers: `npx wrangler rollback` redeploys the previous version in seconds.
- D1 migrations are **irreversible** — a bad migration needs a forward fix
  migration, never a rollback. This is why staging-first is mandatory.
