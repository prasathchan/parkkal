import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirrors the Zod schema in /api/visits/[id]/payments/route.ts
const createPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]).default("CASH"),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  treatmentId: z.string().optional().nullable(),
});

// Business-logic helpers — mirror the overpayment / zero-payment guards in route.ts
function validatePaymentAmount(
  amount: number,
  totalAmount: number,
  paidAmount: number
): { ok: true } | { ok: false; error: string } {
  const due = totalAmount - paidAmount;
  if (due <= 0.001) return { ok: false, error: "Visit is already fully paid" };
  if (amount > due + 0.001) {
    return { ok: false, error: `Payment exceeds balance due of ₹${due.toFixed(2)}` };
  }
  return { ok: true };
}

describe("createPaymentSchema", () => {
  it("accepts a valid cash payment", () => {
    const result = createPaymentSchema.safeParse({ amount: 500, paymentMethod: "CASH" });
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = createPaymentSchema.safeParse({ amount: 0, paymentMethod: "CASH" });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = createPaymentSchema.safeParse({ amount: -100, paymentMethod: "CASH" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown payment method", () => {
    const result = createPaymentSchema.safeParse({ amount: 100, paymentMethod: "CRYPTO" });
    expect(result.success).toBe(false);
  });

  it("defaults payment method to CASH", () => {
    const result = createPaymentSchema.safeParse({ amount: 200 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.paymentMethod).toBe("CASH");
  });

  it("accepts optional treatmentId", () => {
    const result = createPaymentSchema.safeParse({
      amount: 300,
      paymentMethod: "UPI",
      treatmentId: "tx_abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null treatmentId (general payment)", () => {
    const result = createPaymentSchema.safeParse({ amount: 300, treatmentId: null });
    expect(result.success).toBe(true);
  });
});

describe("validatePaymentAmount", () => {
  it("accepts exact due amount", () => {
    expect(validatePaymentAmount(1000, 1000, 0)).toEqual({ ok: true });
  });

  it("accepts partial payment", () => {
    expect(validatePaymentAmount(500, 1000, 0)).toEqual({ ok: true });
  });

  it("rejects overpayment", () => {
    const result = validatePaymentAmount(1001, 1000, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("exceeds balance due");
  });

  it("rejects payment on fully paid visit", () => {
    const result = validatePaymentAmount(100, 1000, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("already fully paid");
  });

  it("tolerates floating-point rounding within 0.001", () => {
    // e.g. ₹333.333... repeated for three equal installments
    expect(validatePaymentAmount(333.334, 1000, 666.666)).toEqual({ ok: true });
  });

  it("rejects payment larger than remaining balance with rounding tolerance", () => {
    const result = validatePaymentAmount(334, 1000, 666.666);
    expect(result.ok).toBe(false);
  });
});
