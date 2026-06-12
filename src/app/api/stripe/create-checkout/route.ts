import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { subscriptionPlans, subscriptions, organizations } from "@/db/schema";
import env from "@/lib/env";

const schema = z.object({
  planId:     z.string().min(1),
  couponCode: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl:  z.string().url().optional(),
});

async function stripePost(path: string, body: Record<string, unknown>): Promise<Response> {
  const params = new URLSearchParams();
  function flatten(obj: Record<string, unknown>, prefix = "") {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        flatten(v as Record<string, unknown>, key);
      } else if (Array.isArray(v)) {
        v.forEach((item, i) => {
          if (typeof item === "object" && item !== null) {
            flatten(item as Record<string, unknown>, `${key}[${i}]`);
          } else {
            params.append(`${key}[${i}]`, String(item));
          }
        });
      } else if (v !== undefined && v !== null) {
        params.append(key, String(v));
      }
    }
  }
  flatten(body);

  return fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
}

/** POST /api/stripe/create-checkout — create a Stripe Checkout Session for plan upgrade */
export const POST = withRoute(
  {
    route:      "POST /api/stripe/create-checkout",
    rateLimit:  RATE_LIMITS.WRITE,
    permission: PERMISSIONS.ORG_SETTINGS,
  },
  async (req, { session, db }) => {
    if (!env.STRIPE_SECRET_KEY) {
      return apiError("Online payments not configured. Please contact support to upgrade.", 503);
    }

    const body   = await req.json() as unknown;
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Invalid input", 400);

    const { planId, couponCode, successUrl, cancelUrl } = parsed.data;

    // Load the plan
    const plan = await db.select().from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.isActive, 1)))
      .get();
    if (!plan) return apiError("Plan not found.", 404);
    if (plan.priceMonthly === 0) return apiError("Free plans do not require payment.", 400);

    // Load org details for customer name/email
    const org = await db.select({ name: organizations.name, email: organizations.email })
      .from(organizations).where(eq(organizations.id, session.orgId)).get();
    if (!org) return apiError("Organisation not found.", 404);

    // Load existing subscription to reuse stripe customer id if available
    const sub = await db.select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions).where(eq(subscriptions.organizationId, session.orgId)).get();

    const appUrl = env.APP_URL ?? "https://parkkal-dental.chandran-aathi.workers.dev";
    const success = successUrl ?? `${appUrl}/dashboard/settings/billing?upgraded=1`;
    const cancel  = cancelUrl  ?? `${appUrl}/dashboard/settings/billing?cancelled=1`;

    // Build checkout session params
    const checkoutParams: Record<string, unknown> = {
      mode:                   "subscription",
      "line_items[0][price_data][currency]":             "inr",
      "line_items[0][price_data][product_data][name]":   plan.name,
      "line_items[0][price_data][unit_amount]":          Math.round(plan.priceMonthly * 100),
      "line_items[0][price_data][recurring][interval]":  "month",
      "line_items[0][quantity]":                         "1",
      success_url:            success,
      cancel_url:             cancel,
      "metadata[org_id]":     session.orgId,
      "metadata[plan_id]":    plan.id,
      "metadata[plan_slug]":  plan.slug,
    };

    if (sub?.stripeCustomerId) {
      checkoutParams["customer"] = sub.stripeCustomerId;
    } else if (org.email) {
      checkoutParams["customer_email"] = org.email;
    }

    if (couponCode) {
      // Look up Stripe coupon by ID (pricing console creates them in Stripe too)
      checkoutParams["discounts[0][coupon]"] = couponCode;
    }

    const stripeRes = await stripePost("/checkout/sessions", checkoutParams);
    if (!stripeRes.ok) {
      const err = await stripeRes.json() as { error?: { message?: string } };
      return apiError(err?.error?.message ?? "Failed to create checkout session.", 502);
    }

    const checkoutSession = await stripeRes.json() as { url: string; id: string };
    return apiOk({ url: checkoutSession.url, sessionId: checkoutSession.id });
  }
);
