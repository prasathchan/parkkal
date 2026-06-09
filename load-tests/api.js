/**
 * API load test — 10 virtual users, 2 minutes
 *
 * Simulates realistic multi-user clinic usage:
 *   - Receptionists searching patients / listing appointments
 *   - Doctors listing their visits and treatments
 *   - Admin viewing reports and staff
 *
 * Usage:
 *   export BASE_URL=http://localhost:3000
 *   export AUTH_COOKIE="pkd_org_session=<token>"
 *   k6 run load-tests/api.js
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Config ─────────────────────────────────────────────────────────────────

const BASE_URL    = __ENV.BASE_URL    || "http://localhost:3000";
const AUTH_COOKIE = __ENV.AUTH_COOKIE || "pkd_org_session=REPLACE_ME";

export const options = {
  stages: [
    { duration: "30s", target: 10 },   // ramp up
    { duration: "1m",  target: 10 },   // steady load
    { duration: "30s", target: 0  },   // ramp down
  ],
  thresholds: {
    http_req_failed:                  ["rate<0.01"],  // < 1% errors
    http_req_duration:                ["p(95)<2000"], // p95 < 2 s
    http_req_duration:                ["p(99)<5000"], // p99 < 5 s
    "http_req_duration{group:::Read patients}": ["p(95)<500"],
    "http_req_duration{group:::List visits}":   ["p(95)<800"],
    "http_req_duration{group:::Reports}":       ["p(95)<3000"], // reports query is heavier
  },
};

const errorRate = new Rate("api_errors");
const reportLatency = new Trend("report_latency");

// ── Helpers ─────────────────────────────────────────────────────────────────

const headers = {
  "Cookie":       AUTH_COOKIE,
  "Content-Type": "application/json",
};

function get(path) {
  const res = http.get(`${BASE_URL}${path}`, { headers });
  errorRate.add(res.status >= 500);
  return res;
}

// ── Scenario ─────────────────────────────────────────────────────────────────

export default function () {
  // ── Receptionist flow ─────────────────────────────────────────────────────
  group("Read patients", () => {
    const res = get("/api/patients?limit=20");
    check(res, { "patients: 200": (r) => r.status === 200 });
    // Search
    const search = get("/api/patients?search=Kumar&limit=10");
    check(search, { "patient search: 200": (r) => r.status === 200 });
  });
  sleep(0.3);

  group("List appointments", () => {
    const today = new Date().toISOString().split("T")[0];
    const res = get(`/api/appointments?date=${today}&limit=20`);
    check(res, { "appointments: 200": (r) => r.status === 200 });
  });
  sleep(0.3);

  // ── Doctor flow ───────────────────────────────────────────────────────────
  group("List visits", () => {
    const res = get("/api/visits?status=OPEN&limit=20");
    check(res, { "visits: 200": (r) => r.status === 200 });
  });
  sleep(0.3);

  group("List treatments", () => {
    const res = get("/api/treatments?limit=20");
    check(res, { "treatments: 200": (r) => r.status === 200 });
  });
  sleep(0.3);

  // ── Admin flow ────────────────────────────────────────────────────────────
  group("Reports", () => {
    const start = Date.now();
    const res = get("/api/reports?period=30d");
    reportLatency.add(Date.now() - start);
    check(res, { "reports: 200 or 403": (r) => r.status === 200 || r.status === 403 });
  });
  sleep(0.5);

  group("Billing list", () => {
    const res = get("/api/visits?billingStatus=UNPAID&limit=20");
    check(res, { "unpaid billing: 200": (r) => r.status === 200 });
  });
  sleep(0.5);
}
