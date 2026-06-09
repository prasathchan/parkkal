/**
 * Spike test — rapid 0→50→0 VU ramp over 60 seconds
 *
 * Tests the system's ability to handle a sudden burst of traffic,
 * e.g. end-of-day billing rush or morning appointment check-in surge.
 *
 * Run this on staging ONLY before going live or adding a new clinic.
 *
 * Usage:
 *   export BASE_URL=https://staging.parkkal.com
 *   export AUTH_COOKIE="pkd_org_session=<token>"
 *   k6 run load-tests/spike.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL    = __ENV.BASE_URL    || "http://localhost:3000";
const AUTH_COOKIE = __ENV.AUTH_COOKIE || "pkd_org_session=REPLACE_ME";

export const options = {
  stages: [
    { duration: "10s", target: 0  },   // baseline idle
    { duration: "10s", target: 50 },   // sudden spike
    { duration: "20s", target: 50 },   // hold spike
    { duration: "10s", target: 0  },   // drop to zero
    { duration: "10s", target: 0  },   // recovery check
  ],
  thresholds: {
    http_req_failed:   ["rate<0.05"],   // allow 5% errors during spike (rate limiting is ok)
    http_req_duration: ["p(95)<5000"],  // p95 < 5 s during spike
  },
};

const errorRate = new Rate("spike_errors");

const headers = {
  "Cookie":       AUTH_COOKIE,
  "Content-Type": "application/json",
};

export default function () {
  // Light read-only requests during spike
  const endpoints = [
    "/api/patients?limit=5",
    "/api/appointments?limit=5",
    "/api/visits?limit=5",
    "/api/auth/me",
  ];

  const url = `${BASE_URL}${endpoints[Math.floor(Math.random() * endpoints.length)]}`;
  const res = http.get(url, { headers });

  // 429 (rate limit) is expected and acceptable during a spike
  errorRate.add(res.status >= 500);
  check(res, {
    "not 5xx": (r) => r.status < 500,
    "responds fast enough": (r) => r.timings.duration < 5000,
  });

  sleep(0.1);
}
