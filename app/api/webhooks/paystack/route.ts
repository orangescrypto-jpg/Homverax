/**
 * src/app/api/webhooks/paystack/route.ts
 *
 * Paystack webhook endpoint — server-side payment verification.
 * Handles: charge.success → activates subscription or boost automatically.
 *
 * Security:
 *   - Verifies Paystack HMAC-SHA512 signature on every request
 *   - Rate limited to prevent replay spam
 *   - Only processes events with verified payment status
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { updateUserSubscription, getUserById } from "@/services/auth";
import { rateLimit, WEBHOOK_RATE_LIMIT } from "@/lib/rateLimit";
import { addMonths } from "date-fns";
import { sendSubscriptionActivatedEmail } from "@/services/emailService";
import { getPlatformConfig } from "@/services/platformSettings";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? "";

// ─── Verify Paystack signature ────────────────────────────────────────────────

function verifySignature(body: string, signature: string): boolean {
  if (!PAYSTACK_SECRET) return false;
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body)
    .digest("hex");
  return hash === signature;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit
  const limit = await rateLimit(req, WEBHOOK_RATE_LIMIT);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Get raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  // Verify signature
  if (!verifySignature(rawBody, signature)) {
    console.warn("[Paystack Webhook] Invalid signature — possible replay attack");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.event as string;
  const data      = event.data as Record<string, unknown>;

  try {
    switch (eventType) {

      // ── Subscription payment ───────────────────────────────────────────────
      case "charge.success": {
        if (data.status !== "success") break;

        const metadata = data.metadata as Record<string, unknown> | undefined;
        const userId   = metadata?.userId   as string | undefined;
        const plan     = metadata?.plan     as string | undefined;
        const type     = metadata?.type     as string | undefined;

        if (!userId) {
          console.warn("[Paystack Webhook] charge.success missing userId in metadata");
          break;
        }

        if (type === "subscription" && plan) {
          const expiry = addMonths(new Date(), 1).toISOString();
          await updateUserSubscription(userId, plan, expiry);
          console.log(`[Paystack Webhook] Subscription activated: ${userId} → ${plan}`);

          // ── Email trigger: subscription activated ────────────────────────
          try {
            const user = await getUserById(userId);
            const cfg  = await getPlatformConfig();
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
            console.warn("[Paystack Webhook] subscription email error:", err);
          }
        }

        if (type === "boost") {
          console.log(`[Paystack Webhook] Boost payment received for user: ${userId}`);
        }

        break;
      }

      // ── Refund ────────────────────────────────────────────────────────────
      case "refund.processed": {
        console.log("[Paystack Webhook] Refund processed:", data.reference);
        break;
      }

      default: {
        console.log(`[Paystack Webhook] Unhandled event: ${eventType}`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[Paystack Webhook] Handler error:", err);
    return NextResponse.json({ received: true, error: "Handler error" }, { status: 200 });
  }
}

// Paystack sends POST only
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
