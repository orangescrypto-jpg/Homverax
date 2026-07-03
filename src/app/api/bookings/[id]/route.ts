/**
 * app/api/bookings/[id]/route.ts
 * PATCH /api/bookings/[id] — update a booking's status. Restricted to the
 * buyer or seller on that specific booking.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec } from "@/lib/d1";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<{ buyer_id: string; seller_id: string }>(
    "SELECT buyer_id, seller_id FROM bookings WHERE id = ?", [id]
  );
  if (!rows.length) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (rows[0].buyer_id !== user.id && rows[0].seller_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.status) return NextResponse.json({ error: "Missing status" }, { status: 400 });

  const now = new Date().toISOString();
  await d1Exec("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?", [body.status, now, id]);
  return NextResponse.json({ success: true });
}
