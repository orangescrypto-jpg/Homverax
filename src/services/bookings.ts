/**
 * services/bookings.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */

import { d1Query, d1Exec, newId } from "@/lib/d1";
import type { Booking } from "@/types";
import { sendBookingConfirmedEmail } from "@/services/emailService";

interface BookingRow {
  id: string;
  listing_id: string;
  listing_title: string | null;
  listing_image: string | null;
  listing_price: number | null;
  buyer_id: string;
  seller_id: string;
  status: string;
  message: string | null;
  escrow_id: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing_title ?? "",
    listingImage: row.listing_image ?? "",
    listingPrice: row.listing_price ?? 0,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    status: (row.status as Booking["status"]) ?? "pending",
    message: row.message ?? undefined,
    escrowId: row.escrow_id ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ✅ FIX: was calling d1Exec()/d1Query() directly from client pages
// (ListingDetailClient, all dashboard variants, bookings page). Silently
// blocked for every non-staff user. Now routed through /api/bookings.
export async function createBooking(params: {
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  buyerId: string;
  sellerId: string;
  message?: string;
}): Promise<Booking> {
  const res = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: params.listingId,
      listingTitle: params.listingTitle,
      listingImage: params.listingImage,
      listingPrice: params.listingPrice,
      sellerId: params.sellerId,
      message: params.message,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to create booking");
  }
  const { booking } = await res.json();
  return booking as Booking;
}

export async function getMyBookings(userId: string): Promise<Booking[]> {
  const res = await fetch("/api/bookings", { cache: "no-store" });
  if (!res.ok) return [];
  const { bookings } = await res.json();
  return (bookings ?? []) as Booking[];
}

export async function updateBookingStatus(id: string, status: Booking["status"]): Promise<void> {
  const res = await fetch(`/api/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to update booking");
  }
}

/**
 * Link booking to an escrow — sets status to 'confirmed'.
 * Triggers booking_confirmed emails to both buyer and seller (fire-and-forget).
 */
export async function linkBookingToEscrow(bookingId: string, escrowId: string): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE bookings SET escrow_id = ?, status = 'confirmed', updated_at = ? WHERE id = ?",
    [escrowId, now, bookingId]
  );

  // ── Email trigger: booking confirmed ──────────────────────────────────────
  try {
    const rows = await d1Query<BookingRow>("SELECT * FROM bookings WHERE id = ?", [bookingId]);
    if (rows.length) {
      const booking = rowToBooking(rows[0]);
      const users = await d1Query<{ id: string; email: string; name: string }>(
        "SELECT id, email, name FROM users WHERE id IN (?, ?)",
        [booking.buyerId, booking.sellerId]
      );
      const buyer  = users.find((u) => u.id === booking.buyerId);
      const seller = users.find((u) => u.id === booking.sellerId);
      if (buyer && seller) {
        void sendBookingConfirmedEmail({
          buyerEmail:   buyer.email,
          buyerName:    buyer.name,
          sellerEmail:  seller.email,
          sellerName:   seller.name,
          listingTitle: booking.listingTitle,
          bookingId:    booking.id,
        });
      }
    }
  } catch (err) {
    console.warn("[bookings] linkBookingToEscrow email error:", err);
  }
}
