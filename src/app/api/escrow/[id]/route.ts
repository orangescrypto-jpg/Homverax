/**
 * app/api/escrow/[id]/route.ts
 * GET    /api/escrow/[id]        — fetch a single escrow transaction
 * PATCH  /api/escrow/[id]        — update escrow status / meta (buyer or seller actions)
 *
 * ✅ FIX: getEscrowById()/updateEscrowStatus() in services/escrow.ts used to
 * call d1Query()/d1Exec() directly from the client. Since lib/d1.ts routes
 * browser D1 calls through the admin/moderator-only proxy at /api/admin/d1,
 * this meant any regular buyer or seller opening their own escrow page (or
 * clicking "I've sent the transfer", "Confirm delivery", etc) got a silent
 * 403 — surfaced as "Transaction not found" / "Failed to load escrow" /
 * "Action failed. Please try again." This route does the same DB work
 * server-side, gated only to "signed in and is the buyer or seller on this
 * escrow", not "is staff".
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec } from "@/lib/d1";
import { createNotification } from "@/services/notifications";
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

const EXPIRY_HOURS = 24;

// Lazily deletes a stale "pending" (never-paid) escrow — checked whenever
// the escrow is fetched, so no cron job is needed. Deleting (not just
// flagging) it means the buyer is immediately free to open a new order for
// the same listing. Anything past "pending" (awaiting_confirmation,
// funded, etc.) has an active claim on it and must not auto-expire.
async function maybeExpire(row: EscrowRow): Promise<EscrowRow | null> {
  if (row.status !== "pending") return row;
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs < EXPIRY_HOURS * 60 * 60 * 1000) return row;

  await d1Exec("DELETE FROM escrows WHERE id = ? AND status = ?", [row.id, "pending"]);
  return null;
}

async function requireParty(id: string) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Unauthorized" as const, status: 401 as const };

  const rows = await d1Query<EscrowRow>("SELECT * FROM escrows WHERE id = ?", [id]);
  if (!rows.length) return { error: "Not found" as const, status: 404 as const };

  const initialRow = rows[0];
  // ✅ FIX: this only ever allowed the buyer or seller of THIS specific
  // escrow to update it — admins/moderators had no bypass at all. Every
  // admin action on the Escrow Management page (Reject transfer, Confirm
  // Payment, etc, when routed through this same PATCH) failed with a
  // silent 403 for any admin who wasn't personally a party to that deal.
  const role = (user.user_metadata?.role as string | undefined) ?? "";
  const isStaff = role === "admin" || role === "moderator";
  if (initialRow.buyer_id !== user.id && initialRow.seller_id !== user.id && !isStaff) {
    return { error: "Forbidden" as const, status: 403 as const };
  }
  const row = await maybeExpire(initialRow);
  if (!row) return { error: "Expired" as const, status: 410 as const };
  return { row, userId: user.id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireParty(id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ escrow: rowToEscrow(result.row, result.userId) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireParty(id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json().catch(() => null);
  if (!body?.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await d1Exec("UPDATE escrows SET status = ?, updated_at = ? WHERE id = ?", [body.status, now, id]);

  if (body.extra && typeof body.extra === "object") {
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(result.row.meta || "{}"); } catch {}
    const merged = { ...meta, ...body.extra };
    await d1Exec("UPDATE escrows SET meta = ?, updated_at = ? WHERE id = ?", [JSON.stringify(merged), now, id]);
  }

  // ── In-app notification for the other party ───────────────────────────────
  // Fire-and-forget — a failed notification must never block the status
  // update itself. Notifies whichever side didn't just perform the action
  // (buyer submits transfer → notify seller; seller/admin flags an issue →
  // notify buyer; either side opens a dispute → notify the other side).
  try {
    let listingTitle = "";
    try { listingTitle = (JSON.parse(result.row.meta || "{}").listingTitle as string) ?? ""; } catch {}
    const otherPartyId =
      result.userId === result.row.buyer_id ? result.row.seller_id : result.row.buyer_id;

    const NOTIF_COPY: Partial<Record<EscrowStatus, { title: string; body: string }>> = {
      awaiting_confirmation: {
        title: "Transfer submitted",
        body: `The buyer has submitted proof of payment for "${listingTitle}". Awaiting confirmation.`,
      },
      held: {
        title: "Funds held in escrow",
        body: `Funds for "${listingTitle}" are now held securely in escrow.`,
      },
      inspection: {
        title: "Inspection period started",
        body: `The inspection period for "${listingTitle}" has begun.`,
      },
      released: {
        title: "Funds released",
        body: `Escrow funds for "${listingTitle}" have been released.`,
      },
      disputed: {
        title: "Dispute opened",
        body: `A dispute has been opened on "${listingTitle}". Our team will review it shortly.`,
      },
      resolved: {
        title: "Dispute resolved",
        body: `The dispute on "${listingTitle}" has been resolved.`,
      },
      refunded: {
        title: "Escrow refunded",
        body: `The escrow for "${listingTitle}" has been refunded.`,
      },
      cancelled: {
        title: "Order cancelled",
        body: `The order for "${listingTitle}" was cancelled.`,
      },
    };
    const copy = NOTIF_COPY[body.status as EscrowStatus];
    if (copy && otherPartyId) {
      void createNotification({
        userId: otherPartyId,
        type: "escrow",
        title: copy.title,
        body: copy.body,
        actionUrl: `/dashboard/escrow/${id}`,
      });
    }
  } catch (err) {
    console.warn("[escrow PATCH] notification error:", err);
  }

  const rows = await d1Query<EscrowRow>("SELECT * FROM escrows WHERE id = ?", [id]);
  return NextResponse.json({ escrow: rowToEscrow(rows[0], result.userId) });
}

// DELETE /api/escrow/[id] — buyer cancels their own escrow.
// Only allowed while status is still "pending" (buyer intends to pay but
// hasn't submitted a transfer yet). This permanently removes the row —
// same as auto-expiry — so the buyer is immediately free to start a new
// order on the same listing. Once a transfer is submitted
// (awaiting_confirmation) or later, cancellation must go through the
// dispute/admin flow instead — money may already be in motion.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireParty(id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.row.buyer_id !== result.userId) {
    return NextResponse.json({ error: "Only the buyer can cancel this order" }, { status: 403 });
  }
  if (result.row.status !== "pending") {
    return NextResponse.json(
      { error: "This order can no longer be cancelled — a transfer has already been submitted" },
      { status: 409 }
    );
  }

  await d1Exec("DELETE FROM escrows WHERE id = ? AND status = ?", [id, "pending"]);

  return NextResponse.json({ ok: true });
}
