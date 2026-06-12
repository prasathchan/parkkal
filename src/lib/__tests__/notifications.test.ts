/**
 * Tests for src/lib/notifications.ts
 *
 * Covers sendNotification() (SMS, WhatsApp, Email) and buildReminderMessage().
 * We mock fetch() globally and env to control which secrets are "set".
 *
 * Key behaviour verified:
 *  - Graceful skip when credentials are absent (no throw, just console.warn)
 *  - Throws on upstream API errors (MSG91 / Resend)
 *  - Correct MSG91/Resend request shape
 *  - WhatsApp falls back to SMS when not separately configured
 *  - buildReminderMessage output for all channels and reminder types
 *  - Indian phone normalisation (10-digit → 91XXXXXXXXXX for MSG91)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendNotification, buildReminderMessage } from "@/lib/notifications";

// ─── Mock env ─────────────────────────────────────────────────────────────────
// Default: all credentials present. Individual tests override as needed.

vi.mock("@/lib/env", () => ({
  default: {
    MSG91_API_KEY:     "testapikey123",
    MSG91_SENDER_ID:   "PARKDNT",
    MSG91_SMS_FLOW_ID: "flow123",
    RESEND_API_KEY:    "re_test_key",
    RESEND_FROM_EMAIL: "reminders@parkkal.com",
  },
}));

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function okResponse(body = '{"type":"success"}') {
  return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
}
function errResponse(status: number, body = "error body") {
  return { ok: false, status, text: async () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue(okResponse());
});

// ─── SMS ─────────────────────────────────────────────────────────────────────

describe("sendNotification — SMS", () => {
  it("calls MSG91 Flow API with authkey header and correct body shape", async () => {
    await sendNotification({ channel: "SMS", to: "9876543210", message: "Your appointment is tomorrow." });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("msg91.com");
    expect(url).toContain("flow");
    expect((opts.headers as Record<string, string>)["authkey"]).toBe("testapikey123");
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body as string);
    expect(body.flow_id).toBe("flow123");
    expect(body.sender).toBe("PARKDNT");
    expect(body.VAR1).toBe("Your appointment is tomorrow.");
  });

  it("normalises 10-digit Indian number to MSG91 format (91XXXXXXXXXX)", async () => {
    await sendNotification({ channel: "SMS", to: "9876543210", message: "Reminder" });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.mobiles).toBe("919876543210");
  });

  it("normalises 91-prefixed 12-digit number correctly", async () => {
    await sendNotification({ channel: "SMS", to: "919876543210", message: "Reminder" });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.mobiles).toBe("919876543210");
  });

  it("normalises E.164 number (+919876543210) to MSG91 format", async () => {
    await sendNotification({ channel: "SMS", to: "+919876543210", message: "Reminder" });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.mobiles).toBe("919876543210");
  });

  it("throws when MSG91 returns a non-OK HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(errResponse(400, "Invalid mobile"));
    await expect(
      sendNotification({ channel: "SMS", to: "+919876543210", message: "Reminder" })
    ).rejects.toThrow("MSG91 SMS error 400");
  });

  it("throws when MSG91 returns type:error in a 200 body", async () => {
    mockFetch.mockResolvedValueOnce(okResponse('{"type":"error","message":"Invalid flow_id"}'));
    await expect(
      sendNotification({ channel: "SMS", to: "+919876543210", message: "Reminder" })
    ).rejects.toThrow("MSG91 SMS error: Invalid flow_id");
  });

  it("skips silently when MSG91_API_KEY is not configured", async () => {
    const { default: env } = await import("@/lib/env");
    const orig = env.MSG91_API_KEY;
    (env as Record<string, unknown>).MSG91_API_KEY = undefined;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      sendNotification({ channel: "SMS", to: "+919876543210", message: "Reminder" })
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();

    (env as Record<string, unknown>).MSG91_API_KEY = orig;
    warn.mockRestore();
  });

  it("skips silently when MSG91_SMS_FLOW_ID is not configured", async () => {
    const { default: env } = await import("@/lib/env");
    const orig = env.MSG91_SMS_FLOW_ID;
    (env as Record<string, unknown>).MSG91_SMS_FLOW_ID = undefined;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      sendNotification({ channel: "SMS", to: "+919876543210", message: "Reminder" })
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();

    (env as Record<string, unknown>).MSG91_SMS_FLOW_ID = orig;
    warn.mockRestore();
  });
});

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

describe("sendNotification — WhatsApp", () => {
  it("falls back to SMS via MSG91 (WhatsApp not yet separately configured)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendNotification({ channel: "WHATSAPP", to: "9876543210", message: "Reminder" });

    // Should have warned about fallback, then called MSG91 flow API
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("WhatsApp not yet configured"), expect.anything());
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("msg91.com");

    warn.mockRestore();
  });
});

// ─── Email ────────────────────────────────────────────────────────────────────

describe("sendNotification — Email", () => {
  it("calls Resend with correct URL, auth header, and JSON body", async () => {
    await sendNotification({
      channel: "EMAIL",
      to: "patient@example.com",
      subject: "Appointment tomorrow",
      message: "Your appointment is tomorrow at 10:00 AM.",
      patientName: "Ravi Kumar",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer re_test_key");

    const body = JSON.parse(opts.body as string);
    expect(body.to).toContain("patient@example.com");
    expect(body.subject).toBe("Appointment tomorrow");
    expect(body.html).toContain("Ravi Kumar");
    expect(body.html).toContain("tomorrow at 10:00 AM");
  });

  it("uses default subject when none provided", async () => {
    await sendNotification({ channel: "EMAIL", to: "p@test.com", message: "Reminder msg" });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.subject).toBe("Appointment Reminder — Parkkal");
  });

  it("throws when Resend returns a non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(errResponse(422, "Invalid email"));
    await expect(
      sendNotification({ channel: "EMAIL", to: "bad@email", message: "Reminder" })
    ).rejects.toThrow("Resend error 422");
  });

  it("skips silently when RESEND_API_KEY is not configured", async () => {
    const { default: env } = await import("@/lib/env");
    const orig = env.RESEND_API_KEY;
    (env as Record<string, unknown>).RESEND_API_KEY = undefined;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      sendNotification({ channel: "EMAIL", to: "p@test.com", message: "Reminder" })
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();

    (env as Record<string, unknown>).RESEND_API_KEY = orig;
    warn.mockRestore();
  });
});

// ─── Unknown channel ──────────────────────────────────────────────────────────

describe("sendNotification — unknown channel", () => {
  it("throws for an unrecognised channel value", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendNotification({ channel: "TELEGRAM" as any, to: "+91x", message: "x" })
    ).rejects.toThrow("Unknown notification channel: TELEGRAM");
  });
});

// ─── buildReminderMessage ─────────────────────────────────────────────────────

describe("buildReminderMessage", () => {
  const BASE = {
    patientName:     "Sunita Devi",
    clinicName:      "Parkkal Dental",
    appointmentDate: "2025-12-15",
    appointmentTime: "10:00",
    doctorName:      "Dr. Meera",
    reminderType:    "24H" as const,
    channel:         "SMS" as const,
  };

  it("includes patientName, clinicName, and doctor in SMS message", () => {
    const msg = buildReminderMessage(BASE);
    expect(msg).toContain("Sunita Devi");
    expect(msg).toContain("Parkkal Dental");
    expect(msg).toContain("Dr. Meera");
  });

  it("uses 'tomorrow' timing for 24H reminder", () => {
    expect(buildReminderMessage({ ...BASE, reminderType: "24H" })).toContain("tomorrow");
  });

  it("uses 'in 2 hours' timing for 2H reminder", () => {
    expect(buildReminderMessage({ ...BASE, reminderType: "2H" })).toContain("in 2 hours");
  });

  it("uses 'in 1 hour' timing for 1H reminder", () => {
    expect(buildReminderMessage({ ...BASE, reminderType: "1H" })).toContain("in 1 hour");
  });

  it("omits doctor line when doctorName is not provided", () => {
    const { doctorName: _, ...withoutDoctor } = BASE;
    const msg = buildReminderMessage(withoutDoctor);
    expect(msg).not.toContain("Doctor:");
  });

  it("WhatsApp message uses markdown bold formatting", () => {
    const msg = buildReminderMessage({ ...BASE, channel: "WHATSAPP" });
    expect(msg).toContain("*");
    expect(msg).toContain("🦷");
  });

  it("SMS message does not contain markdown bold markers", () => {
    const msg = buildReminderMessage({ ...BASE, channel: "SMS" });
    expect(msg).not.toContain("*Appointment");
  });

  it("Email message is plain text (same as SMS)", () => {
    const sms   = buildReminderMessage({ ...BASE, channel: "SMS" });
    const email = buildReminderMessage({ ...BASE, channel: "EMAIL" });
    expect(sms).toBe(email);
  });
});
