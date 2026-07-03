/**
 * app/api/bookings/route.ts
 * GET  /api/bookings — the signed-in user's own bookings (as buyer or seller).
 * POST /api/bookings — create a new booking (viewing request) as the signed-in user.
 *
 * ✅ FIX: createBooking()/getMyBookings() in services/bookings.ts called
 * d1Query()/d1Exec() directly from client pages (ListingDetailClient,
 * AgentDashboard, ServiceProviderDashboard, TenantDashboard, bookings
 * page). Silently blocked for every non-staff user — the "No bookings
 * yet" dashboard bug even when bookings existed.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec, newId } from "@/lib/d1";

interface BookingRow {
  id: string; listing_id: string; listing_title: string | null; listing_image: string | null;
  listing_price: number | null; buyer_id: string; seller_id: string; status: string;
  message: string | null; escrow_id: string | null; scheduled_at: string | null;
  created_at: string; updated_at: string;
}

function rowToBooking(row: BookingRow) {
  return {
    id: row.id, listingId: row.listing_id, listingTitle: row.listing_title ?? "",
    listingImage: row.listing_image ?? "", listingPrice: row.listing_price ?? 0,
    buyerId: row.buyer_id, sellerId: row.seller_id, status: row.status ?? "pending",
    message: row.message ?? undefined, escrowId: row.escrow_id ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<BookingRow>(
    "SELECT * FROM bookings WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC",
    [user.id, user.id]
  );
  const bookings = rows.map(rowToBooking);
  return NextResponse.json({ bookings });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { listingId, listingTitle, listingImage, listingPrice, sellerId, message } = body ?? {};
  if (!listingId || !sellerId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = newId();
  const now = new Date().toISOString();
  await d1Exec(
    `INSERT INTO bookings
       (id, listing_id, listing_title, listing_image, listing_price,
        buyer_id, seller_id, status, message, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, listingId, listingTitle ?? null, listingImage ?? null, listingPrice ?? null,
     user.id, sellerId, "pending", message ?? null, now, now]
  );

  const rows = await d1Query<BookingRow>("SELECT * FROM bookings WHERE id = ?", [id]);
  return NextResponse.json({ booking: rowToBooking(rows[0]) });
}
