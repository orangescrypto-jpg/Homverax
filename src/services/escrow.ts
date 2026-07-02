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

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to initiate escrow");
  }

  const { escrow } = await res.json();
  return escrow as EscrowTransaction;
}

export async function getEscrowById(id: string): Promise<EscrowTransaction | null> {
  const rows = await d1Query<EscrowRow>("SELECT * FROM escrows WHERE id = ?", [id]);
  if (!rows.length) return null;
  return rowToEscrow(rows[0]);
}

export async function getMyEscrows(userId: string): Promise<EscrowTransaction[]> {
  const rows = await d1Query<EscrowRow>(
    "SELECT * FROM escrows WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC",
    [userId, userId]
  );
  const map = new Map<string, EscrowTransaction>();
  rows.forEach((r) => map.set(r.id, rowToEscrow(r, userId)));
  return Array.from(map.values());
}

async function updateMeta(id: string, extra: Record<string, unknown>): Promise<void> {
  const rows = await d1Query<EscrowRow>("SELECT meta FROM escrows WHERE id = ?", [id]);
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(rows[0]?.meta || "{}"); } catch {}
  const merged = { ...meta, ...extra };
  const now = new Date().toISOString();
  await d1Exec("UPDATE escrows SET meta = ?, updated_at = ? WHERE id = ?", [JSON.stringify(merged), now, id]);
}

export async function updateEscrowStatus(
  id: string,
  status: EscrowStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("UPDATE escrows SET status = ?, updated_at = ? WHERE id = ?", [status, now, id]);
  if (extra) await updateMeta(id, extra);
}

export async function submitTransferProof(id: string, reference: string): Promise<void> {
  await updateEscrowStatus(id, "awaiting_confirmation", {
    transferReference: reference,
    transferSubmittedAt: new Date().toISOString(),
  });
}

/**
 * Admin confirms payment received — escrow moves to "funded".
 * Triggers escrow_funded emails to both buyer and seller (fire-and-forget).
 */
export async function adminConfirmFunding(id: string, adminNote?: string): Promise<void> {
  await updateEscrowStatus(id, "funded", { depositPaidAt: new Date().toISOString(), adminNote: adminNote ?? null });

  // ── Email trigger: escrow funded ──────────────────────────────────────────
  try {
    const escrow = await getEscrowById(id);
    if (escrow) {
      // Fetch buyer and seller emails from users table
      const users = await d1Query<{ id: string; email: string; name: string }>(
        "SELECT id, email, name FROM users WHERE id IN (?, ?)",
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
        });
      }
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

export async function confirmDelivery(id: string): Promise<void> {
  await updateEscrowStatus(id, "released", { releasedAt: new Date().toISOString() });

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
    }
  } catch (err) {
    console.warn("[escrow] confirmDelivery post-release error:", err);
  }
}

export async function openDispute(id: string, reason: string): Promise<void> {
  await updateEscrowStatus(id, "disputed", { disputeReason: reason, disputeOpenedAt: new Date().toISOString() });
}

export async function resolveDispute(id: string, refund: boolean): Promise<void> {
  await updateEscrowStatus(id, refund ? "refunded" : "resolved", { resolvedAt: new Date().toISOString() });
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
  await updateEscrowStatus(id, "released", {
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
