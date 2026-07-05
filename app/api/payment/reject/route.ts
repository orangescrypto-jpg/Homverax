// app/api/payment/reject/route.ts
// Admin/moderator rejects a manual payment proof on the /admin/payments page.
// Distinct from /api/orders/cancel-admin: rejection is RETRY-ABLE — the
// order stays alive so the buyer can resubmit proof on the same order via
// /api/payment/retry, instead of the payment vanishing with no explanation
// and the buyer having to start a brand new checkout.
//
// Effects:
//   - pending_payments row: status -> 'rejected', reason/rejected_at/rejected_by set
//   - orders row (if linked): status -> 'payment_rejected', same audit fields set
//   - buyer notified (email + in-app) with the reason
//   - seller notified (email + in-app) that the order is on hold — no reason
//     detail needed for the seller since it's not their payment to fix
//   - admin BCC'd automatically via the shared adminNotifyEmails config
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { AdminService } from "@/src/services/admin"
import { Emails } from "@/src/services/email"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function ngn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireModerator(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const { reference, reason } = await req.json()
    if (!reference) return NextResponse.json({ error: "reference required" }, { status: 400 })
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 })
    }
    const trimmedReason = String(reason).trim()

    const paymentRows = await d1Query(
      "SELECT * FROM pending_payments WHERE reference = ? LIMIT 1",
      [reference],
      nativeDB,
    )
    const payment = (paymentRows?.results?.[0] ?? null) as Record<string, unknown> | null
    if (!payment) return NextResponse.json({ error: `No pending payment for: ${reference}` }, { status: 404 })

    if (payment.admin_confirmed) {
      return NextResponse.json({ error: "This payment was already confirmed and cannot be rejected." }, { status: 409 })
    }
    if (String(payment.status ?? "") === "rejected") {
      return NextResponse.json({ error: "This payment has already been rejected." }, { status: 409 })
    }

    const now = new Date().toISOString()

    await d1Query(
      `UPDATE pending_payments
       SET status = 'rejected', rejection_reason = ?, rejected_at = ?, rejected_by = ?
       WHERE id = ?`,
      [trimmedReason, now, auth.uid, String(payment.id)],
      nativeDB,
    )

    const meta = (() => {
      try { return JSON.parse(String(payment.metadata ?? "{}")) } catch { return {} }
    })()
    const orderId = String(meta.orderId ?? "")

    let order: Record<string, unknown> | null = null
    if (orderId) {
      const orderRows = await d1Query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId], nativeDB)
      order = (orderRows?.results?.[0] ?? null) as Record<string, unknown> | null

      if (order) {
        await d1Query(
          `UPDATE orders
           SET status = 'payment_rejected', rejection_reason = ?, rejected_at = ?, rejected_by = ?, updated_at = ?
           WHERE id = ?`,
          [trimmedReason, now, auth.uid, now, orderId],
          nativeDB,
        )
      }
    }

    const buyerId   = String(order?.buyer_id ?? payment.user_id ?? payment.userId ?? "")
    const sellerId  = String(order?.seller_id ?? "")
    const itemTitle = String(order?.item_title ?? meta.itemTitle ?? "your order")
    const amount    = Number(payment.amount ?? order?.total_amount ?? 0)

    // ── Buyer: in-app notification + email with the reason ─────────────
    if (buyerId) {
      try {
        await AdminService.addDoc("notifications", {
          user_id: buyerId,
          type:    "system",
          title:   "❌ Payment Not Confirmed",
          body:    `We couldn't confirm your payment for "${itemTitle}". Reason: ${trimmedReason}. Tap to retry.`,
          link:    orderId ? `/dashboard/buyer/orders/${orderId}` : "/dashboard/buyer/orders",
          is_read: false,
        })
      } catch (err) {
        console.error("[payment/reject] buyer notification failed (non-fatal):", err)
      }

      try {
        const buyer = await AdminService.getDoc("users", buyerId) as Record<string, unknown> | null
        const buyerEmail = String(buyer?.email ?? "")
        if (buyerEmail && orderId) {
          Emails.paymentRejected(buyerEmail, {
            recipientName: String(buyer?.fullName ?? "there"),
            role:          "buyer",
            itemTitle,
            orderId,
            amount:        ngn(amount),
            reason:        trimmedReason,
          }).catch(() => { /* fire-and-forget — already logged inside sendEmail */ })
        }
      } catch (err) {
        console.error("[payment/reject] buyer email failed (non-fatal):", err)
      }
    }

    // ── Seller: in-app notification + email — order is on hold ─────────
    if (sellerId) {
      try {
        await AdminService.addDoc("notifications", {
          user_id: sellerId,
          type:    "system",
          title:   "⏸️ Order On Hold",
          body:    `The buyer's payment for "${itemTitle}" could not be confirmed. The order is on hold until they resubmit.`,
          link:    orderId ? `/dashboard/seller/orders/${orderId}` : "/dashboard/seller/orders",
          is_read: false,
        })
      } catch (err) {
        console.error("[payment/reject] seller notification failed (non-fatal):", err)
      }

      try {
        const seller = await AdminService.getDoc("users", sellerId) as Record<string, unknown> | null
        const sellerEmail = String(seller?.email ?? "")
        if (sellerEmail && orderId) {
          Emails.paymentRejected(sellerEmail, {
            recipientName: String(seller?.fullName ?? "there"),
            role:          "seller",
            itemTitle,
            orderId,
            amount:        ngn(amount),
            reason:        trimmedReason,
          }).catch(() => { /* fire-and-forget — already logged inside sendEmail */ })
        }
      } catch (err) {
        console.error("[payment/reject] seller email failed (non-fatal):", err)
      }
    }

    return NextResponse.json({ success: true, orderId: orderId || null })
  } catch (err: any) {
    console.error("[POST /api/payment/reject]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
