# Load Tests

These scripts use [k6](https://k6.io/) — a CLI tool, no npm package needed.

## Install k6

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Scripts

| Script | Purpose | When to run |
|---|---|---|
| `smoke.js` | 1 VU, 30s — verify nothing crashes | Before every deployment |
| `api.js` | 10 VU, 2m — realistic API load | Weekly / before major releases |
| `spike.js` | 0→50→0 VU in 1m — surge tolerance | Before public launch |

## Running

```bash
# Always run against local or staging — NEVER production
export BASE_URL=http://localhost:3000
export AUTH_COOKIE="pkd_org_session=<your-session-cookie>"

# Smoke test (safe, ~30 seconds)
k6 run load-tests/smoke.js

# API load test (moderate, ~2 minutes)
k6 run load-tests/api.js

# Spike test (aggressive, ~1 minute)
k6 run load-tests/spike.js

# With summary output
k6 run --out json=load-tests/results.json load-tests/api.js
```

## Getting AUTH_COOKIE for tests

1. Log into the app at localhost:3000
2. Open DevTools → Application → Cookies
3. Copy the `pkd_org_session` cookie value
4. Set: `export AUTH_COOKIE="pkd_org_session=<value>"`

## Thresholds (pass/fail criteria)

| Metric | Threshold |
|---|---|
| HTTP error rate | < 1% |
| p95 response time | < 2 000 ms |
| p99 response time | < 5 000 ms |

Tests fail (exit code 1) when thresholds are breached — safe to use in CI gates.
