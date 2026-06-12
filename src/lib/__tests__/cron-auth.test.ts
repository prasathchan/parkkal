/**
 * Tests for verifyCronAuth — the spoofing-resistant cron route guard.
 *
 * Key property under test: the x-cloudflare-cron header alone is NOT enough.
 * It is only trusted when cf-connecting-ip is absent (i.e. the request did
 * not traverse the public Cloudflare edge — internal scheduled self-fetch).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/env", () => ({
  default: { CRON_SECRET: "test-cron-secret-1234567890" },
}));

import { verifyCronAuth } from "@/lib/cron-auth";

function req(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/cron/retention", { headers });
}

describe("verifyCronAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows internal cron delivery (cron header, no edge header)", () => {
    expect(verifyCronAuth(req({ "x-cloudflare-cron": "0 2 * * *" }))).toBeNull();
  });

  it("REJECTS spoofed cron header arriving via the public edge", () => {
    const res = verifyCronAuth(
      req({ "x-cloudflare-cron": "0 2 * * *", "cf-connecting-ip": "203.0.113.7" }),
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("allows a correct CRON_SECRET bearer token even from the edge", () => {
    const res = verifyCronAuth(
      req({
        "cf-connecting-ip": "203.0.113.7",
        authorization: "Bearer test-cron-secret-1234567890",
      }),
    );
    expect(res).toBeNull();
  });

  it("rejects a wrong bearer token", () => {
    const res = verifyCronAuth(
      req({ "cf-connecting-ip": "203.0.113.7", authorization: "Bearer wrong" }),
    );
    expect(res!.status).toBe(401);
  });

  it("rejects a bare request with no credentials at all", () => {
    expect(verifyCronAuth(req({}))!.status).toBe(401);
  });
});
