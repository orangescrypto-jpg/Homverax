/**
 * services/escrow.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */

import { d1Query, d1Exec, newId } from "@/lib/d1";
import type { EscrowTransaction, EscrowStatus } from "@/types";
import { getPlatformConfig, calcBuyerServiceCharge, calcSellerPlatformFee } from "@/services/platformSettings";
import {
  sendEscrowFundedEmail,
  sendEscrowReleasedEmail,
} from "@/services/emailService";
import { createNotification } from "@/services/notifications";
import { creditWalletOnRelease } from "@/services/wallet";

export type EscrowListingType = "sale" | "rent" | "shortlet" | "service";

export interface EscrowFeeBreakdown {
  listingPrice: number;
  buyerServiceCharge: number;
  buyerServiceChargePercent: number;
  buyerServiceChargeLabel: string;
  buyerTotal: number;
  sellerPlatformFee: number;
  sellerPlatformFeePercent: number;
  sellerReceives: number;
}

interface EscrowRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: string;
  release_at: string | null;
  created_at: string;
  updated_at: string;
  // extended fields stored as JSON blob
  meta: string | null;
}

function rowToEscrow(row: EscrowRow, userId?: string): EscrowTransaction {
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(row.meta || "{}"); } catch {}
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: (meta.listingTitle as string) ?? "",
    listingImage: (meta.listingImage as string) ?? "",
    listingPrice: (meta.listingPrice as number) ?? row.amount,
    listingLocation: (meta.listingLocation as string) ?? "",
    listingType: ((meta.listingType as string) ?? "sale") as EscrowListingType,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amount: row.amount,
    buyerServiceCharge: (meta.buyerServiceCharge as number) ?? 0,
    buyerServiceChargePercent: (meta.buyerServiceChargePercent as number) ?? 0,
    buyerServiceChargeLabel: (meta.buyerServiceChargeLabel as string) ?? "Service Charge",
    buyerTotal: (meta.buyerTotal as number) ?? row.amount,
    platformFee: (meta.platformFee as number) ?? 0,
    platformFeePercent: (meta.platformFeePercent as number) ?? 0,
    sellerReceives: (meta.sellerReceives as number) ?? row.amount,
    status: row.status as EscrowStatus,
    role: userId === row.buyer_id ? "buyer" : "seller",
    paymentReference: (meta.paymentReference as string) ?? undefined,
    // ✅ FIX: these two were missing from this rowToEscrow entirely, so the
    // admin escrow list (getAllEscrows, used by /admin/escrows) never saw
    // the buyer's transfer reference or uploaded receipt — even though
    // both were saved correctly to meta by submitTransferProof(). Admin
    // always displayed "No receipt attached" regardless of what the buyer
    // actually submitted.
    transferReference: (meta.transferReference as string) ?? undefined,
    transferSubmittedAt: (meta.transferSubmittedAt as string) ?? undefined,
    receiptUrl: (meta.receiptUrl as string) ?? undefined,
    depositPaidAt: (meta.depositPaidAt as string) ?? undefined,
    fundsHeldAt: (meta.fundsHeldAt as string) ?? undefined,
    inspectionDate: (meta.inspectionDate as string) ?? undefined,
    releasedAt: (meta.releasedAt as string) ?? undefined,
    disputeReason: (meta.disputeReason as string) ?? undefined,
    disputeOpenedAt: (meta.disputeOpenedAt as string) ?? undefined,
    resolvedAt: (meta.resolvedAt as string) ?? undefined,
    notes: (meta.notes as string) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getEscrowFeeBreakdown(
  listingPrice: number,
  listingType: EscrowListingType,
): Promise<EscrowFeeBreakdown> {
  const cfg = await getPlatformConfig();
  const { serviceCharge, total } = calcBuyerServiceCharge(listingPrice, cfg.escrowFees);
  const { platformFee, sellerReceives, feePercent } = calcSellerPlatformFee(listingPrice, listingType, cfg.escrowFees);
  return {
    listingPrice,
    buyerServiceCharge: serviceCharge,
    buyerServiceChargePercent: cfg.escrowFees.buyerServiceChargePercent,
    buyerServiceChargeLabel: cfg.escrowFees.buyerServiceChargeLabel,
    buyerTotal: total,
    sellerPlatformFee: platformFee,
    sellerPlatformFeePercent: feePercent,
    sellerReceives,
  };
}

// ✅ FIX: was calling d1Query()/d1Exec() directly from the client, which —
// via the admin/moderator-only proxy in lib/d1.ts — silently blocked every
// regular buyer from starting an escrow transaction, surfacing only as
// "Failed to initiate escrow. Please try again." Now calls a public,
// any-signed-in-user route that does the DB write server-side.
export class DuplicateEscrowError extends Error {
  escrow: EscrowTransaction;
  constructor(message: string, escrow: EscrowTransaction) {
    super(message);
    this.name = "DuplicateEscrowError";
    this.escrow = escrow;
  }
}

export async function initiateEscrow(params: {
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  listingLocation: string;
  listingType: EscrowListingType;
  buyerId: string;
  sellerId: string;
  amount: number;
}): Promise<EscrowTransaction> {
  const res = await fetch("/api/escrow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    if (body?.error === "duplicate_order" && body?.escrow) {
      throw new DuplicateEscrowError(body.message ?? "Duplicate order", body.escrow as EscrowTransaction);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to initiate escrow");
  }

  const { escrow } = await res.json();
  return escrow as EscrowTransaction;
}

// ✅ FIX: was calling d1Query() directly from the client, which — via the
// admin-gated proxy — silently blocked regular buyers/sellers from loading
// their own escrow, surfacing as "Transaction not found" / "Failed to load
// escrow". Now calls a public route scoped to the signed-in party.
export async function getEscrowById(id: string): Promise<EscrowTransaction | null> {
  const res = await fetch(`/api/escrow/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const { escrow } = await res.json();
  return escrow as EscrowTransaction;
}

// ✅ FIX: same issue as getEscrowById — now calls a public route scoped to
// the signed-in user instead of hitting D1 directly from the client.
export async function getMyEscrows(userId: string): Promise<EscrowTransaction[]> {
  const res = await fetch("/api/escrow/mine", { cache: "no-store" });
  if (!res.ok) return [];
  const { escrows } = await res.json();
  return escrows as EscrowTransaction[];
}

async function updateMeta(id: string, extra: Record<string, unknown>): Promise<void> {
  const rows = await d1Query<EscrowRow>("SELECT meta FROM escrows WHERE id = ?", [id]);
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(rows[0]?.meta || "{}"); } catch {}
  const merged = { ...meta, ...extra };
  const now = new Date().toISOString();
  await d1Exec("UPDATE escrows SET meta = ?, updated_at = ? WHERE id = ?", [JSON.stringify(merged), now, id]);
}

// ✅ FIX: updateEscrowStatus() used by buyer/seller actions (submit
// transfer proof, hold, start inspection, confirm delivery, open dispute)
// used to call d1Exec() directly from the client, hitting the admin-gated
// proxy and failing silently for regular users ("Action failed. Please
// try again."). This version goes through the public, party-scoped PATCH
// route instead. Admin-only status changes (confirm funding, release,
// resolve dispute) keep using updateEscrowStatusAdmin below, which is
// correctly gated to staff via the existing D1 proxy.
export async function updateEscrowStatus(
  id: string,
  status: EscrowStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/escrow/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, extra }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to update escrow");
  }
}

// Buyer-only: cancel a still-"pending" (unpaid) escrow via the party-scoped
// DELETE route. Sets status to "cancelled" — row stays for the record.
export async function cancelEscrow(id: string): Promise<void> {
  const res = await fetch(`/api/escrow/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to cancel order");
  }
}

// Admin-only: permanently delete an escrow row from the database. Goes
// through d1Exec, which is routed via the admin/moderator-gated proxy at
// /api/admin/d1 (see lib/d1.ts) — same pattern as the other admin-only
// escrow actions below (adminConfirmFunding, releaseToSeller, etc). This
// is irreversible; callers should confirm with the admin before invoking.
export async function adminDeleteEscrow(id: string): Promise<void> {
  await d1Exec("DELETE FROM escrows WHERE id = ?", [id]);
}

async function updateEscrowStatusAdmin(
  id: string,
  status: EscrowStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("UPDATE escrows SET status = ?, updated_at = ? WHERE id = ?", [status, now, id]);
  if (extra) await updateMeta(id, extra);
}

export async function submitTransferProof(id: string, reference: string, receiptUrl?: string): Promise<void> {
  await updateEscrowStatus(id, "awaiting_confirmation", {
    transferReference: reference,
    transferSubmittedAt: new Date().toISOString(),
    ...(receiptUrl ? { receiptUrl } : {}),
  });
}

/**
 * Admin confirms payment received — escrow moves to "funded".
 * Triggers escrow_funded emails to both buyer and seller (fire-and-forget).
 */
export async function adminConfirmFunding(id: string, adminNote?: string): Promise<void> {
  await updateEscrowStatusAdmin(id, "funded", { depositPaidAt: new Date().toISOString(), adminNote: adminNote ?? null });

  // ── Email trigger: escrow funded ──────────────────────────────────────────
  try {
    const escrow = await getEscrowById(id);
    if (escrow) {
      // Fetch buyer and seller info from users table (phone included so we
      // can share the buyer's number with the seller now that payment is
      // confirmed — never shared earlier, at initiation).
      const users = await d1Query<{ id: string; email: string; name: string; phone: string | null }>(
        "SELECT id, email, name, phone FROM users WHERE id IN (?, ?)",
        [escrow.buyerId, escrow.sellerId]
      );
      const buyer  = users.find((u) => u.id === escrow.buyerId);
      const seller = users.find((u) => u.id === escrow.sellerId);
      if (buyer && seller) {
        void sendEscrowFundedEmail({
          buyerEmail:  buyer.email,
          buyerName:   buyer.name,
          sellerEmail: seller.email,
          sellerName:  seller.name,
          listingTitle: escrow.listingTitle,
          amount:      escrow.amount,
          escrowId:    escrow.id,
          buyerPhone:  buyer.phone ?? undefined,
        });
      }
      // ── In-app notification: both parties ──────────────────────────────
      void createNotification({
        userId: escrow.buyerId,
        type: "escrow",
        title: "Payment confirmed",
        body: `Your payment for "${escrow.listingTitle}" has been confirmed and is now held in escrow.`,
        actionUrl: `/dashboard/escrow/${escrow.id}`,
      });
      void createNotification({
        userId: escrow.sellerId,
        type: "escrow",
        title: "Funds received in escrow",
        body: `Payment for "${escrow.listingTitle}" has been confirmed and is held in escrow.`,
        actionUrl: `/dashboard/escrow/${escrow.id}`,
      });
    }
  } catch (err) {
    console.warn("[escrow] adminConfirmFunding email error:", err);
  }
}

export async function holdEscrow(id: string): Promise<void> {
  await updateEscrowStatus(id, "held", { fundsHeldAt: new Date().toISOString() });
}

export async function startInspection(id: string, inspectionDate: string): Promise<void> {
  await updateEscrowStatus(id, "inspection", { inspectionDate });
}

// ✅ FIX: this used to also call creditWalletOnRelease() and look up
// buyer/seller emails directly from the client via d1Query()/d1Exec() —
// both silently failed for regular users (admin-gated D1 proxy), so the
// seller's wallet was never actually credited even though the escrow
// showed "released". That work now happens server-side in the PATCH
// handler at /api/escrow/[id]/route.ts, triggered whenever status
// transitions to "released" — this function just needs to request that
// transition.
export async function confirmDelivery(id: string): Promise<void> {
  await updateEscrowStatus(id, "released", { releasedAt: new Date().toISOString() });
}

export async function openDispute(id: string, reason: string): Promise<void> {
  await updateEscrowStatus(id, "disputed", { disputeReason: reason, disputeOpenedAt: new Date().toISOString() });
}

export async function resolveDispute(id: string, refund: boolean): Promise<void> {
  await updateEscrowStatusAdmin(id, refund ? "refunded" : "resolved", { resolvedAt: new Date().toISOString() });

  try {
    const escrow = await getEscrowById(id);
    if (escrow) {
      const copy = refund
        ? { title: "Dispute resolved — refunded", body: `The dispute on "${escrow.listingTitle}" was resolved with a refund to the buyer.` }
        : { title: "Dispute resolved", body: `The dispute on "${escrow.listingTitle}" has been resolved.` };
      void createNotification({ userId: escrow.buyerId, type: "escrow", title: copy.title, body: copy.body, actionUrl: `/dashboard/escrow/${escrow.id}` });
      void createNotification({ userId: escrow.sellerId, type: "escrow", title: copy.title, body: copy.body, actionUrl: `/dashboard/escrow/${escrow.id}` });
    }
  } catch (err) {
    console.warn("[escrow] resolveDispute notification error:", err);
  }
}

export async function getAllEscrows(): Promise<EscrowTransaction[]> {
  const rows = await d1Query<EscrowRow>("SELECT * FROM escrows ORDER BY created_at DESC", []);
  return rows.map((r) => rowToEscrow(r));
}

/**
 * Admin manually releases funds to seller.
 * Triggers escrow_released emails to both parties (fire-and-forget).
 */
export async function releaseToSeller(id: string, adminNote: string, paymentReference: string): Promise<void> {
  await updateEscrowStatusAdmin(id, "released", {
    releasedAt: new Date().toISOString(),
    adminReleaseNote: adminNote,
    adminPaymentReference: paymentReference,
  });

  try {
    const escrow = await getEscrowById(id);
    if (escrow) {
      // ── Credit seller wallet ─────────────────────────────────────────────
      void creditWalletOnRelease(escrow.sellerId, escrow.amount, escrow.platformFee, escrow.id);

      // ── Email trigger ────────────────────────────────────────────────────
      const users = await d1Query<{ id: string; email: string; name: string }>(
        "SELECT id, email, name FROM users WHERE id IN (?, ?)",
        [escrow.buyerId, escrow.sellerId]
      );
      const buyer  = users.find((u) => u.id === escrow.buyerId);
      const seller = users.find((u) => u.id === escrow.sellerId);
      if (buyer && seller) {
        void sendEscrowReleasedEmail({
          sellerEmail:    seller.email,
          sellerName:     seller.name,
          buyerEmail:     buyer.email,
          buyerName:      buyer.name,
          listingTitle:   escrow.listingTitle,
          sellerReceives: escrow.sellerReceives,
          platformFee:    escrow.platformFee,
          escrowId:       escrow.id,
        });
      }
      // ── In-app notification: both parties ──────────────────────────────
      void createNotification({
        userId: escrow.sellerId,
        type: "escrow",
        title: "Funds released",
        body: `Funds for "${escrow.listingTitle}" have been released to your wallet.`,
        actionUrl: `/dashboard/escrow/${escrow.id}`,
      });
      void createNotification({
        userId: escrow.buyerId,
        type: "escrow",
        title: "Transaction complete",
        body: `The escrow for "${escrow.listingTitle}" has been released to the seller.`,
        actionUrl: `/dashboard/escrow/${escrow.id}`,
      });
    }
  } catch (err) {
    console.warn("[escrow] releaseToSeller post-release error:", err);
  }
}

export async function getSellerBankDetails(
  sellerId: string,
): Promise<{ bankName: string; accountNumber: string; accountName: string } | null> {
  const rows = await d1Query<{ bank_name: string | null; account_number: string | null; account_name: string | null }>(
    "SELECT bank_name, account_number, account_name FROM users WHERE id = ?",
    [sellerId]
  );
  if (!rows.length || !rows[0].bank_name) return null;
  return {
    bankName: rows[0].bank_name,
    accountNumber: rows[0].account_number ?? "",
    accountName: rows[0].account_name ?? "",
  };
}
