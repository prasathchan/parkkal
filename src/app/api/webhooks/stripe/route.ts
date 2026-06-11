/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe subscription lifecycle events.
 * Verifies signature using STRIPE_WEBHOOK_SECRET.
 * No auth session needed — Stripe signs the request.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { subscriptions } from "@/db/schema";
import env from "@/lib/env";

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const sig       = parts["v1"];
  if (!timestamp || !sig) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === sig;
}

export async function POST(req: NextRequest) {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const payload   = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  const valid = await verifyStripeSignature(payload, signature, webhookSecret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;
  const db    = getDb();
  const now   = Date.now();

  switch (event.type) {
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub  = event.data.object;
      const stripeSubId = sub["id"] as string;
      const status      = sub["status"] as string;
      const periodEnd   = (sub["current_period_end"] as number) * 1000;
      const periodStart = (sub["current_period_start"] as number) * 1000;

      const mappedStatus =
        status === "active"   ? "active"   :
        status === "past_due" ? "past_due" :
        status === "canceled" ? "cancelled" : "active";

      await db.update(subscriptions).set({
        status:             mappedStatus,
        currentPeriodStart: periodStart,
        currentPeriodEnd:   periodEnd,
        updatedAt:          now,
      }).where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
      break;
    }

    case "customer.subscription.deleted": {
      const sub       = event.data.object;
      const stripeSubId = sub["id"] as string;
      await db.update(subscriptions).set({
        status:      "cancelled",
        cancelledAt: now,
        updatedAt:   now,
      }).where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
      break;
    }

    case "invoice.payment_failed": {
      const invoice     = event.data.object;
      const stripeSubId = invoice["subscription"] as string;
      if (stripeSubId) {
        await db.update(subscriptions).set({
          status:    "past_due",
          updatedAt: now,
        }).where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
