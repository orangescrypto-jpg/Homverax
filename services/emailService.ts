/**
 * services/emailService.ts
 * Email notification helpers — server-side only.
 *
 * This module MUST only be imported from API routes and server-side service
 * functions. It must NEVER be imported from client components or browser code.
 *
 * Calls /api/email via absolute URL (NEXT_PUBLIC_APP_URL) + an internal
 * shared secret (EMAIL_INTERNAL_SECRET) so the endpoint cannot be triggered
 * directly from a browser.
 */

/**
 * Internal helper — POSTs to /api/email with an absolute URL and the
 * internal secret header. Fire-and-forget: errors are caught and logged,
 * never re-thrown, so email failures never block the underlying transaction.
 */
async function dispatchEmail(
  template: string,
  to: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
    const secret = process.env.EMAIL_INTERNAL_SECRET ?? "";

    const res = await fetch(`${baseUrl}/api/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-email-internal-secret": secret } : {}),
      },
      body: JSON.stringify({ template, to, data }),
    });

    if (!res.ok) {
      console.warn(`[emailService] /api/email returned ${res.status} for template=${template}`);
    }
  } catch (err) {
    // Email failures must never block the underlying transaction
    console.warn(`[emailService] Failed to dispatch ${template} to ${to}:`, err);
  }
}

// ─── 1. Escrow funded ─────────────────────────────────────────────────────────

export async function sendEscrowFundedEmail(params: {
  buyerEmail: string;
  buyerName: string;
  sellerEmail: string;
  sellerName: string;
  listingTitle: string;
  amount: number;
  escrowId: string;
}): Promise<void> {
  await Promise.all([
    dispatchEmail("escrow_funded_buyer",  params.buyerEmail,  params),
    dispatchEmail("escrow_funded_seller", params.sellerEmail, params),
  ]);
}

// ─── 2. Escrow released ───────────────────────────────────────────────────────

export async function sendEscrowReleasedEmail(params: {
  sellerEmail: string;
  sellerName: string;
  buyerEmail: string;
  buyerName: string;
  listingTitle: string;
  sellerReceives: number;
  platformFee: number;
  escrowId: string;
}): Promise<void> {
  await Promise.all([
    dispatchEmail("escrow_released_seller", params.sellerEmail, params),
    dispatchEmail("escrow_released_buyer",  params.buyerEmail,  params),
  ]);
}

// ─── 3. Booking confirmed ─────────────────────────────────────────────────────

export async function sendBookingConfirmedEmail(params: {
  buyerEmail: string;
  buyerName: string;
  sellerEmail: string;
  sellerName: string;
  listingTitle: string;
  bookingId: string;
}): Promise<void> {
  await Promise.all([
    dispatchEmail("booking_confirmed_buyer",  params.buyerEmail,  params),
    dispatchEmail("booking_confirmed_seller", params.sellerEmail, params),
  ]);
}

// ─── 4. Payout approved ───────────────────────────────────────────────────────

export async function sendPayoutApprovedEmail(params: {
  userEmail: string;
  userName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
}): Promise<void> {
  await dispatchEmail("payout_approved", params.userEmail, params);
}

// ─── 5. Verification approved ─────────────────────────────────────────────────

export async function sendVerificationApprovedEmail(params: {
  userEmail: string;
  userName: string;
  verificationType: string;
}): Promise<void> {
  await dispatchEmail("verification_approved", params.userEmail, params);
}

// ─── 6. Subscription activated ────────────────────────────────────────────────

export async function sendSubscriptionActivatedEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
  expiresAt: string;
}): Promise<void> {
  await dispatchEmail("subscription_activated", params.userEmail, params);
}
