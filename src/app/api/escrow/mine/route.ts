/**
 * app/api/escrow/mine/route.ts
 * GET /api/escrow/mine — list escrow transactions where the signed-in user
 * is buyer or seller. Same fix pattern as /api/escrow and /api/escrow/[id]:
 * avoids the admin-gated D1 proxy so regular users can load their own
 * escrow list.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";
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

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await d1Query<EscrowRow>(
    "SELECT * FROM escrows WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC",
    [user.id, user.id]
  );
  const map = new Map<string, EscrowTransaction>();
  rows.forEach((r) => map.set(r.id, rowToEscrow(r, user.id)));

  return NextResponse.json({ escrows: Array.from(map.values()) });
}
