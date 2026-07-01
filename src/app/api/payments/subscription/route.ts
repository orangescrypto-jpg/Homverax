import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackPayment } from "@/services/payment";
import { updateUserSubscription, getUserById } from "@/services/auth";
import { addMonths } from "date-fns";
import { rateLimit, SUBSCRIPTION_RATE_LIMIT } from "@/lib/rateLimit";
import { sendSubscriptionActivatedEmail } from "@/services/emailService";
import { getPlatformConfig } from "@/services/platformSettings";

/**
 * POST /api/payments/subscription
 * Called after successful Paystack subscription payment.
 * Upgrades the user's subscription plan in D1.
 * Rate limited: 20 requests per minute per IP.
 */
export async function POST(req: NextRequest) {
  // ── Rate limit ──────────────────────────────────────────────────────────────
  const limit = await rateLimit(req, SUBSCRIPTION_RATE_LIMIT);
  if (!limit.success) {
    return NextResponse.json(
      { error: limit.message },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit":     String(SUBSCRIPTION_RATE_LIMIT.limit),
          "X-RateLimit-Remaining": String(limit.remaining),
          "X-RateLimit-Reset":     String(limit.resetAt),
          "Retry-After":           String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  try {
    const body = await req.json();
    const { reference, userId, plan } = body;

    if (!reference || !userId || !plan) {
      return NextResponse.json(
        { error: "Missing required fields: reference, userId, plan" },
        { status: 400 },
      );
    }

    // ── Verify payment with Paystack ─────────────────────────────────────────
    const isValid = await verifyPaystackPayment(reference);
    if (!isValid) {
      return NextResponse.json(
        { error: "Payment could not be verified. Please contact support." },
        { status: 402 },
      );
    }

    // ── Upgrade subscription ─────────────────────────────────────────────────
    const expiry = addMonths(new Date(), 1).toISOString();
    await updateUserSubscription(userId, plan, expiry);

    // ── Email trigger: subscription activated ────────────────────────────────
    try {
      const user   = await getUserById(userId);
      const cfg    = await getPlatformConfig();
      const planObj = cfg.subscriptionPlans.find((p) => p.slug === plan);
      if (user) {
        void sendSubscriptionActivatedEmail({
          userEmail: user.email,
          userName:  user.name,
          planName:  planObj?.name ?? plan,
          expiresAt: new Date(expiry).toLocaleDateString("en-NG", { dateStyle: "long" }),
        });
      }
    } catch (err) {
      console.warn("[/api/payments/subscription] email error:", err);
    }

    return NextResponse.json(
      { success: true, plan, expiry },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit":     String(SUBSCRIPTION_RATE_LIMIT.limit),
          "X-RateLimit-Remaining": String(limit.remaining),
        },
      },
    );
  } catch (err) {
    console.error("Subscription upgrade error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
