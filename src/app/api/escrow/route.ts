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
import { sendEscrowInitiatedEmail } from "@/services/emailService";
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

  // ✅ Prevent duplicate orders: if this buyer already has a live (not
  // cancelled/expired) escrow on this same listing, don't create another —
  // send them back to the existing one instead. Only "pending" and
  // "awaiting_confirmation" count as "still needs the buyer's attention";
  // anything further along (funded/held/etc) is also blocking since the
  // deal is already in progress.
  const existing = await d1Query<EscrowRow>(
    `SELECT * FROM escrows WHERE listing_id = ? AND buyer_id = ?
     AND status NOT IN ('cancelled', 'expired', 'refunded')
     ORDER BY created_at DESC LIMIT 1`,
    [body.listingId, buyerId]
  );
  if (existing.length) {
    return NextResponse.json(
      {
        error: "duplicate_order",
        message: "You already have an active order for this listing.",
        escrow: rowToEscrow(existing[0], buyerId),
      },
      { status: 409 }
    );
  }

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

  // ── Feature 1: notify seller that escrow has been initiated ──────────────
  // Fire-and-forget — a failed/slow email must never block escrow creation
  // or the buyer's flow. No phone number is shared here (business rule:
  // contact info only shared once payment is confirmed/funded).
  try {
    const [buyerRow] = await d1Query<{ id: string; name: string }>(
      "SELECT id, name FROM users WHERE id = ?",
      [buyerId]
    );
    const [sellerRow] = await d1Query<{ id: string; email: string; name: string }>(
      "SELECT id, email, name FROM users WHERE id = ?",
      [body.sellerId]
    );
    if (sellerRow) {
      void sendEscrowInitiatedEmail({
        sellerEmail: sellerRow.email,
        sellerName: sellerRow.name,
        buyerName: buyerRow?.name ?? "A buyer",
        listingTitle: body.listingTitle ?? "",
        escrowId: id,
      });
      void createNotification({
        userId: body.sellerId,
        type: "escrow",
        title: "A buyer wants to purchase",
        body: `${buyerRow?.name ?? "A buyer"} has started a purchase for "${body.listingTitle ?? "your listing"}". Payment is pending.`,
        actionUrl: `/dashboard/escrow/${id}`,
      });
    }
  } catch (err) {
    console.warn("[escrow] sendEscrowInitiatedEmail error:", err);
  }

  // ── Feature 3: auto-open a chat thread between buyer and seller ──────────
  // Fire-and-forget — a failure here must never block escrow creation.
  // Conversations in this app aren't their own row; a thread only exists
  // once a message has been sent (found later by matching sender/receiver/
  // listing on the messages table — see services/messages.ts). So we send
  // one small system-style message on the buyer's behalf. The buyer never
  // sees this happen and isn't taken to the chat — they proceed straight
  // to the bank transfer screen as normal. The seller will see the thread
  // (with this message already in it) whenever they open Messages, and can
  // reply immediately, well before payment is confirmed.
  //
  // Inlined rather than importing startConversation()/sendMessage() from
  // services/messages.ts, since that module imports the browser Supabase
  // client (@/lib/supabase/client) and isn't safe to import into a server
  // route. Same find-existing-first logic as startConversation(): reuse
  // the buyer/seller/listing thread if one already exists (e.g. they
  // messaged before buying), otherwise start a new one.
  try {
    const existingMsg = await d1Query<{ conversation_id: string }>(
      `SELECT conversation_id FROM messages
       WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
       AND listing_id IS ? LIMIT 1`,
      [buyerId, body.sellerId, body.sellerId, buyerId, body.listingId ?? null]
    );
    const convId = existingMsg.length ? existingMsg[0].conversation_id : newId();
    const msgId = newId();
    const autoMessage =
      `Escrow started for "${body.listingTitle ?? "this listing"}" — ` +
      `payment is pending confirmation.`;
    await d1Exec(
      "INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, content, read, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [msgId, convId, buyerId, body.sellerId, body.listingId, autoMessage, 0, now]
    );
  } catch (err) {
    console.warn("[escrow] auto-conversation creation error:", err);
  }

  const rows = await d1Query<EscrowRow>("SELECT * FROM escrows WHERE id = ?", [id]);
  return NextResponse.json({ escrow: rowToEscrow(rows[0], buyerId) });
}
