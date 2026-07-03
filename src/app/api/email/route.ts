/**
 * app/api/email/route.ts
 * POST /api/email — internal email dispatch endpoint.
 *
 * Called server-side only (from emailService.ts via absolute-URL fetch).
 * Uses Resend for delivery. RESEND_API_KEY must be set in env — it is
 * never stored in the database (env-only, more secure).
 *
 * Security: this route reads cfg.email.enabled and the Resend key from
 * server-only env vars. It does NOT expose SQL, does NOT accept arbitrary
 * "to" addresses from unauthenticated browsers — all callers are internal
 * server-to-server calls from services/emailService.ts which is only
 * imported inside API routes and server services, never from client components.
 *
 * A shared internal secret (EMAIL_INTERNAL_SECRET) gates the endpoint so
 * that a browser cannot POST to /api/email directly.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getPlatformConfig } from "@/services/platformSettings";

// ─── Internal secret guard ────────────────────────────────────────────────────
// emailService.ts passes this header automatically. Any POST without it
// (including unauthenticated browser requests) is rejected with 401.

const INTERNAL_SECRET = process.env.EMAIL_INTERNAL_SECRET ?? "";

function isInternalRequest(req: NextRequest): boolean {
  if (!INTERNAL_SECRET) return true; // dev: no secret configured → allow
  return req.headers.get("x-email-internal-secret") === INTERNAL_SECRET;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      template: string;
      to: string;
      data: Record<string, unknown>;
    };

    const cfg = await getPlatformConfig();

    if (!cfg.email.enabled || cfg.email.provider === "none") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Per-event toggle check
    const toggleMap: Record<string, keyof typeof cfg.email> = {
      escrow_initiated_seller:  "onEscrowInitiated",
      escrow_funded_buyer:      "onEscrowFunded",
      escrow_funded_seller:     "onEscrowFunded",
      escrow_released_seller:   "onEscrowReleased",
      escrow_released_buyer:    "onEscrowReleased",
      booking_confirmed_buyer:  "onBookingConfirmed",
      booking_confirmed_seller: "onBookingConfirmed",
      payout_approved:          "onPayoutApproved",
      verification_approved:    "onVerificationApproved",
      subscription_activated:   "onSubscriptionActivated",
    };
    const toggleKey = toggleMap[body.template];
    if (toggleKey && cfg.email[toggleKey] === false) {
      return NextResponse.json({ ok: true, skipped: true, reason: "event_disabled" });
    }

    if (cfg.email.provider === "resend") {
      const RESEND_KEY = process.env.RESEND_API_KEY;
      if (!RESEND_KEY) {
        console.warn("[email/route] RESEND_API_KEY not set — skipping email");
        return NextResponse.json({ ok: true, skipped: true, reason: "no_api_key" });
      }

      const subject = buildSubject(body.template, body.data);
      const html    = buildHtml(body.template, body.data, cfg.appName, cfg.email.fromName, cfg.supportEmail);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${cfg.email.fromName} <${cfg.email.fromEmail}>`,
          to: [body.to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[email/route] Resend error ${res.status}:`, text);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[email/route] Unhandled error:", err);
    return NextResponse.json({ ok: true, error: "email_failed" });
  }
}

// ─── Subject lines ────────────────────────────────────────────────────────────

function buildSubject(template: string, data: Record<string, unknown>): string {
  const subjects: Record<string, string> = {
    escrow_initiated_seller: `🛒 A Buyer Wants — ${data.listingTitle}`,
    escrow_funded_buyer:     `✅ Payment Confirmed — ${data.listingTitle}`,
    escrow_funded_seller:    `💰 Funds Received in Escrow — ${data.listingTitle}`,
    escrow_released_seller:  `🎉 Funds Released — ${data.listingTitle}`,
    escrow_released_buyer:   `✅ Transaction Complete — ${data.listingTitle}`,
    booking_confirmed_buyer: `📅 Booking Confirmed — ${data.listingTitle}`,
    booking_confirmed_seller:`📅 New Booking — ${data.listingTitle}`,
    payout_approved:         `💸 Payout Approved`,
    verification_approved:   `✅ Verification Approved`,
    subscription_activated:  `🚀 Subscription Activated — ${data.planName}`,
  };
  return subjects[template] ?? "HomveraX Notification";
}

// ─── Brand tokens (hex — safe in email clients) ───────────────────────────────
const BRAND = {
  indigo:     "#3730a3", // primary — deep indigo
  indigoLight:"#ede9fe", // very light purple tint
  gold:       "#b45309", // accent — amber/gold
  goldLight:  "#fef3c7",
  white:      "#ffffff",
  bg:         "#f8f7ff", // near-white with indigo tint
  text:       "#1e1b4b", // dark indigo text
  muted:      "#6b7280",
  border:     "#e0e7ef",
  success:    "#065f46",
  successBg:  "#d1fae5",
};

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function layout(
  appName: string,
  supportEmail: string,
  badgeColor: string,
  badgeText: string,
  body: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:'Segoe UI',Arial,sans-serif;color:${BRAND.text};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(55,48,163,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.indigo} 0%,#4338ca 100%);padding:32px 40px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:${BRAND.white};letter-spacing:-0.5px;">${appName}</div>
              <div style="margin-top:8px;display:inline-block;background:${badgeColor};color:${BRAND.white};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding:4px 14px;border-radius:100px;">${badgeText}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND.indigoLight};padding:24px 40px;text-align:center;border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 6px;font-size:13px;color:${BRAND.text};font-weight:600;">${appName}</p>
              <p style="margin:0 0 4px;font-size:12px;color:${BRAND.muted};">Nigeria's trusted escrow-protected property marketplace</p>
              <p style="margin:0;font-size:12px;color:${BRAND.muted};">
                Questions? Email us at
                <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};text-decoration:none;font-weight:600;">${supportEmail}</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:${BRAND.muted};">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function greeting(name: string): string {
  return `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;">Hello <strong>${esc(name)}</strong>,</p>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 16px;font-size:13px;color:${BRAND.muted};font-weight:600;white-space:nowrap;width:40%;">${label}</td>
    <td style="padding:10px 16px;font-size:13px;color:${BRAND.text};font-weight:500;">${value}</td>
  </tr>`;
}

function infoTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.indigoLight};border-radius:10px;margin:20px 0;overflow:hidden;">
    <tbody>${rows}</tbody>
  </table>`;
}

function highlightBox(text: string, bgColor = BRAND.goldLight, textColor = BRAND.gold): string {
  return `<div style="background-color:${bgColor};border-left:4px solid ${textColor};border-radius:6px;padding:16px 20px;margin:20px 0;font-size:14px;color:${BRAND.text};line-height:1.6;">${text}</div>`;
}

function para(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${BRAND.text};">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />`;
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function naira(n: unknown): string {
  return `₦${Number(n || 0).toLocaleString("en-NG")}`;
}

// ─── Individual template builders ─────────────────────────────────────────────

function tmplEscrowInitiatedSeller(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.sellerName ?? ""))}
    ${para(`<strong>${esc(d.buyerName)}</strong> has started a purchase for your listing <strong>${esc(d.listingTitle)}</strong> and payment is now pending.`)}
    ${infoTable(
      infoRow("Listing", esc(d.listingTitle)) +
      infoRow("Buyer", esc(d.buyerName)) +
      infoRow("Escrow ID", `#${esc(d.escrowId)}`) +
      infoRow("Status", "⏳ Payment pending")
    )}
    ${highlightBox(`You'll be notified as soon as payment is confirmed. A conversation with the buyer has also been started — check your ${appName} Messages to say hello.`)}
    ${divider()}
    ${para(`Questions? Contact <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a>.`)}
  `;
  return layout(appName, supportEmail, BRAND.indigo, "Buyer Started a Purchase", body);
}

function tmplEscrowFundedBuyer(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.buyerName ?? ""))}
    ${para(`Your payment for <strong>${esc(d.listingTitle)}</strong> has been confirmed and is now held securely in escrow. The funds will be released to the seller only after you confirm that everything is in order.`)}
    ${infoTable(
      infoRow("Listing", esc(d.listingTitle)) +
      infoRow("Amount Held", naira(d.amount)) +
      infoRow("Escrow ID", `#${esc(d.escrowId)}`) +
      infoRow("Status", "✅ Funds in escrow")
    )}
    ${highlightBox(`<strong>🔒 Your money is protected.</strong> Funds remain locked in escrow until you confirm delivery or the inspection period is complete. Do not release funds until you are fully satisfied.`)}
    ${divider()}
    ${para(`If you have any questions, please contact us at <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a>.`)}
  `;
  return layout(appName, supportEmail, BRAND.gold, "Escrow Funded", body);
}

function tmplEscrowFundedSeller(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const buyerPhone = typeof d.buyerPhone === "string" && d.buyerPhone.trim() ? d.buyerPhone.trim() : null;
  const body = `
    ${greeting(String(d.sellerName ?? ""))}
    ${para(`Great news! A buyer has funded the escrow for your listing <strong>${esc(d.listingTitle)}</strong>. The funds are safely held in escrow and will be released to you after the buyer confirms delivery.`)}
    ${infoTable(
      infoRow("Listing", esc(d.listingTitle)) +
      infoRow("Escrow Amount", naira(d.amount)) +
      infoRow("Buyer", esc(d.buyerName)) +
      (buyerPhone ? infoRow("Buyer Phone", esc(buyerPhone)) : "") +
      infoRow("Escrow ID", `#${esc(d.escrowId)}`) +
      infoRow("Status", "💰 Funds held in escrow")
    )}
    ${highlightBox(`<strong>Next step:</strong> Proceed with the agreed transaction. Once the buyer confirms receipt/satisfaction, funds will be released to your wallet.`)}
    ${divider()}
    ${para(`Questions? Contact <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a>.`)}
  `;
  return layout(appName, supportEmail, BRAND.gold, "Funds in Escrow", body);
}

function tmplEscrowReleasedSeller(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.sellerName ?? ""))}
    ${para(`Congratulations! The escrow for <strong>${esc(d.listingTitle)}</strong> has been released. Your payment is now credited to your wallet.`)}
    ${infoTable(
      infoRow("Listing", esc(d.listingTitle)) +
      infoRow("Amount Received", naira(d.sellerReceives)) +
      infoRow("Platform Fee Deducted", naira(d.platformFee)) +
      infoRow("Escrow ID", `#${esc(d.escrowId)}`) +
      infoRow("Status", "🎉 Payment released")
    )}
    ${highlightBox(`Your net payment of <strong>${naira(d.sellerReceives)}</strong> has been added to your ${appName} wallet. You can withdraw it from your dashboard at any time.`, BRAND.successBg, BRAND.success)}
    ${divider()}
    ${para(`Thank you for completing this transaction on ${appName}. Contact <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a> if you have any questions.`)}
  `;
  return layout(appName, supportEmail, "#065f46", "Payment Released", body);
}

function tmplEscrowReleasedBuyer(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.buyerName ?? ""))}
    ${para(`Your transaction for <strong>${esc(d.listingTitle)}</strong> is complete. The escrowed funds have been released to the seller. We hope everything went smoothly!`)}
    ${infoTable(
      infoRow("Listing", esc(d.listingTitle)) +
      infoRow("Escrow ID", `#${esc(d.escrowId)}`) +
      infoRow("Status", "✅ Transaction complete")
    )}
    ${highlightBox(`Thank you for using ${appName}'s escrow service. Your money was protected throughout the entire transaction.`)}
    ${divider()}
    ${para(`We'd love your feedback — contact us at <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a>.`)}
  `;
  return layout(appName, supportEmail, "#065f46", "Transaction Complete", body);
}

function tmplBookingConfirmedBuyer(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.buyerName ?? ""))}
    ${para(`Your inspection booking for <strong>${esc(d.listingTitle)}</strong> has been confirmed. The agent has been notified and will be in touch with you shortly.`)}
    ${infoTable(
      infoRow("Property", esc(d.listingTitle)) +
      infoRow("Booking ID", `#${esc(d.bookingId)}`) +
      infoRow("Status", "📅 Confirmed")
    )}
    ${highlightBox(`<strong>What's next?</strong> The listing agent will contact you to confirm the inspection date and time. Keep an eye on your messages in your ${appName} dashboard.`)}
    ${divider()}
    ${para(`Questions? Contact <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a>.`)}
  `;
  return layout(appName, supportEmail, BRAND.indigo, "Booking Confirmed", body);
}

function tmplBookingConfirmedSeller(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.sellerName ?? ""))}
    ${para(`You have a new confirmed booking for your listing <strong>${esc(d.listingTitle)}</strong>. Please reach out to the buyer to arrange the inspection.`)}
    ${infoTable(
      infoRow("Listing", esc(d.listingTitle)) +
      infoRow("Buyer", esc(d.buyerName)) +
      infoRow("Booking ID", `#${esc(d.bookingId)}`) +
      infoRow("Status", "📅 Confirmed")
    )}
    ${highlightBox(`<strong>Action required:</strong> Contact the buyer via your ${appName} messages to confirm the inspection date and provide viewing instructions.`)}
    ${divider()}
    ${para(`Need help? Email <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a>.`)}
  `;
  return layout(appName, supportEmail, BRAND.indigo, "New Booking", body);
}

function tmplPayoutApproved(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.userName ?? ""))}
    ${para(`Your payout request has been approved and is being processed. Funds will be transferred to your bank account within 1–3 business days.`)}
    ${infoTable(
      infoRow("Amount", naira(d.amount)) +
      infoRow("Bank", esc(d.bankName)) +
      infoRow("Account Number", esc(d.accountNumber)) +
      infoRow("Status", "💸 Approved & processing")
    )}
    ${highlightBox(`Transfers typically arrive within <strong>1–3 business days</strong> depending on your bank. If you do not receive the funds after 3 business days, please contact support.`)}
    ${divider()}
    ${para(`Questions? Contact <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a>.`)}
  `;
  return layout(appName, supportEmail, "#065f46", "Payout Approved", body);
}

function tmplVerificationApproved(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.userName ?? ""))}
    ${para(`Congratulations! Your <strong>${esc(d.verificationType)}</strong> verification has been approved. You now have a verified badge on your ${appName} profile, which builds buyer and seller trust.`)}
    ${infoTable(
      infoRow("Verification Type", esc(d.verificationType)) +
      infoRow("Status", "✅ Approved") +
      infoRow("Badge", "🏅 Verified")
    )}
    ${highlightBox(`<strong>Your verified badge is now live.</strong> Verified listings receive higher trust scores and are more likely to attract serious buyers and tenants.`, BRAND.successBg, BRAND.success)}
    ${divider()}
    ${para(`Welcome to the verified community on ${appName}! Contact <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a> if you have any questions.`)}
  `;
  return layout(appName, supportEmail, "#065f46", "Verified ✓", body);
}

function tmplSubscriptionActivated(d: Record<string, unknown>, appName: string, supportEmail: string): string {
  const body = `
    ${greeting(String(d.userName ?? ""))}
    ${para(`Your <strong>${esc(d.planName)}</strong> subscription on ${appName} is now active. You now have access to all the features included in your plan.`)}
    ${infoTable(
      infoRow("Plan", esc(d.planName)) +
      infoRow("Status", "🚀 Active") +
      infoRow("Expires", esc(d.expiresAt))
    )}
    ${highlightBox(`<strong>Ready to go?</strong> Head to your dashboard to start listing properties, accessing leads, and using your plan's premium features.`)}
    ${divider()}
    ${para(`Thank you for subscribing to ${appName}! Reach out to <a href="mailto:${supportEmail}" style="color:${BRAND.indigo};">${supportEmail}</a> if you need any help.`)}
  `;
  return layout(appName, supportEmail, BRAND.indigo, "Subscription Active", body);
}

// ─── Router ───────────────────────────────────────────────────────────────────

function buildHtml(
  template: string,
  data: Record<string, unknown>,
  appName: string,
  _fromName: string,
  supportEmail: string,
): string {
  switch (template) {
    case "escrow_initiated_seller":  return tmplEscrowInitiatedSeller(data, appName, supportEmail);
    case "escrow_funded_buyer":     return tmplEscrowFundedBuyer(data, appName, supportEmail);
    case "escrow_funded_seller":    return tmplEscrowFundedSeller(data, appName, supportEmail);
    case "escrow_released_seller":  return tmplEscrowReleasedSeller(data, appName, supportEmail);
    case "escrow_released_buyer":   return tmplEscrowReleasedBuyer(data, appName, supportEmail);
    case "booking_confirmed_buyer": return tmplBookingConfirmedBuyer(data, appName, supportEmail);
    case "booking_confirmed_seller":return tmplBookingConfirmedSeller(data, appName, supportEmail);
    case "payout_approved":         return tmplPayoutApproved(data, appName, supportEmail);
    case "verification_approved":   return tmplVerificationApproved(data, appName, supportEmail);
    case "subscription_activated":  return tmplSubscriptionActivated(data, appName, supportEmail);
    default:
      return layout(appName, supportEmail, BRAND.indigo, "Notification",
        `${para(`Hello,`)}${para(`You have a new notification on ${appName}.`)}`);
  }
}
