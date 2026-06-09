/**
 * Smoke test — 1 virtual user, 30 seconds
 *
 * Goal: confirm the app starts and all critical endpoints respond.
 * Run this BEFORE every deployment from staging.
 *
 * Usage:
 *   export BASE_URL=http://localhost:3000
 *   export AUTH_COOKIE="pkd_org_session=<token>"
 *   k6 run load-tests/smoke.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// ── Config ─────────────────────────────────────────────────────────────────

const BASE_URL    = __ENV.BASE_URL    || "http://localhost:3000";
const AUTH_COOKIE = __ENV.AUTH_COOKIE || "pkd_org_session=REPLACE_ME";

export const options = {
  vus:      1,
  duration: "30s",
  thresholds: {
    http_req_failed:                 ["rate<0.01"],  // < 1% errors
    http_req_duration:               ["p(95)<2000"], // 95% under 2 s
    "http_req_duration{type:read}":  ["p(95)<1000"], // reads faster
    "http_req_duration{type:write}": ["p(95)<3000"], // writes can be slower
  },
};

const errorRate = new Rate("errors");

// ── Helpers ─────────────────────────────────────────────────────────────────

const headers = {
  "Cookie":       AUTH_COOKIE,
  "Content-Type": "application/json",
};

function get(path, tags = {}) {
  const res = http.get(`${BASE_URL}${path}`, { headers, tags: { type: "read", ...tags } });
  errorRate.add(res.status >= 400 && res.status !== 401 && res.status !== 403);
  return res;
}

// ── Scenario ─────────────────────────────────────────────────────────────────

export default function () {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const me = get("/api/auth/me");
  check(me, { "me: 200 or 401": (r) => r.status === 200 || r.status === 401 });
  sleep(0.5);

  // ── Patients ──────────────────────────────────────────────────────────────
  const patients = get("/api/patients?limit=10");
  check(patients, { "patients: 200": (r) => r.status === 200 });
  sleep(0.5);

  // ── Appointments ─────────────────────────────────────────────────────────
  const appts = get("/api/appointments?limit=10");
  check(appts, { "appointments: 200": (r) => r.status === 200 });
  sleep(0.5);

  // ── Visits ────────────────────────────────────────────────────────────────
  const visits = get("/api/visits?limit=10");
  check(visits, { "visits: 200": (r) => r.status === 200 });
  sleep(0.5);

  // ── Reports ───────────────────────────────────────────────────────────────
  const reports = get("/api/reports?period=30d");
  check(reports, { "reports: 200 or 403": (r) => r.status === 200 || r.status === 403 });
  sleep(1);
}
