/**
 * app/api/escrow/route.ts
 * POST /api/escrow — initiates an escrow transaction.
 *
 * ✅ FIX: initiateEscrow() in services/escrow.ts used to call d1Query()/
 * d1Exec() directly from the client. Since lib/d1.ts routes browser D1
 * calls through the admin/moderator-only proxy at /api/admin/d1, this
 * meant any regular buyer clicking "Confirm & Pay" got a silent 403 —
 * surfaced to the user only as "Failed to initiate escrow. Please try
 * again." This route does the same DB work server-side, gated only to
 * "signed in", not "is staff" — the correct requirement for a buyer
 * starting an escrow transaction.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec, newId } from "@/lib/d1";
import {
  loadPlatformConfigFromDb,
  calcBuyerServiceCharge,
  calcSellerPlatformFee,
} from "@/services/platformSettings";
import type { EscrowTransaction, EscrowStatus } from "@/types";

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
    listingType: ((meta.listingType as string) ?? "sale") as EscrowTransaction["listingType"],
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

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.listingId || !body?.sellerId || body?.amount == null) {
    return NextResponse.json({ error: "Missing escrow data" }, { status: 400 });
  }

  // ✅ Always use the authenticated user's id as buyer, never a client-supplied one.
  const buyerId = user.id;

  // ✅ FIX: getPlatformConfig() does a relative fetch("/api/config"), which
  // has no base URL when called from server-side code (this route), so it
  // silently failed and fell back to DEFAULT_CONFIG (1% buyer fee) — this
  // is why an escrow was created with a 1%/₦2,500 fee even after admin set
  // it to 0%. loadPlatformConfigFromDb() reads the real saved config
  // directly, which is what server-side code should use.
  const cfg = await loadPlatformConfigFromDb();
  const { serviceCharge, total } = calcBuyerServiceCharge(body.amount, cfg.escrowFees);
  const { platformFee, sellerReceives, feePercent } = calcSellerPlatformFee(
    body.amount,
    body.listingType ?? "sale",
    cfg.escrowFees
  );

  const id = newId();
  const now = new Date().toISOString();
  const meta = JSON.stringify({
    listingTitle: body.listingTitle ?? "",
    listingImage: body.listingImage ?? "",
    listingPrice: body.listingPrice ?? body.amount,
    listingLocation: body.listingLocation ?? "",
    listingType: body.listingType ?? "sale",
    buyerServiceCharge: serviceCharge,
    buyerServiceChargePercent: cfg.escrowFees.buyerServiceChargePercent,
    buyerServiceChargeLabel: cfg.escrowFees.buyerServiceChargeLabel,
    buyerTotal: total,
    platformFee,
    platformFeePercent: feePercent,
    sellerReceives,
  });

  await d1Exec(
    "INSERT INTO escrows (id, listing_id, buyer_id, seller_id, amount, status, meta, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [id, body.listingId, buyerId, body.sellerId, body.amount, "pending", meta, now, now]
  );

  const rows = await d1Query<EscrowRow>("SELECT * FROM escrows WHERE id = ?", [id]);
  return NextResponse.json({ escrow: rowToEscrow(rows[0], buyerId) });
}
