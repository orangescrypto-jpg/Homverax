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

export async function createBooking(params: {
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  buyerId: string;
  sellerId: string;
  message?: string;
}): Promise<Booking> {
  const id = newId();
  const now = new Date().toISOString();
  await d1Exec(
    `INSERT INTO bookings
       (id, listing_id, listing_title, listing_image, listing_price,
        buyer_id, seller_id, status, message, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, params.listingId, params.listingTitle, params.listingImage, params.listingPrice,
      params.buyerId, params.sellerId, "pending", params.message ?? null, now, now,
    ]
  );
  const rows = await d1Query<BookingRow>("SELECT * FROM bookings WHERE id = ?", [id]);
  return rowToBooking(rows[0]);
}

export async function getMyBookings(userId: string): Promise<Booking[]> {
  const rows = await d1Query<BookingRow>(
    "SELECT * FROM bookings WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC",
    [userId, userId]
  );
  // Deduplicate (shouldn't happen, but mirrors Firebase behavior)
  const map = new Map<string, Booking>();
  rows.forEach((r) => map.set(r.id, rowToBooking(r)));
  return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateBookingStatus(id: string, status: Booking["status"]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?", [status, now, id]);
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
