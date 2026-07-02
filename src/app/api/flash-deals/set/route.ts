/**
 * app/api/flash-deals/set/route.ts
 * POST /api/flash-deals/set — create/update a flash deal on the caller's
 * own listing.
 *
 * ✅ FIX: setFlashDeal() in services/flashDeals.ts called d1Query()/
 * d1Exec() directly from client code, which the admin-gated D1 proxy
 * silently blocked (403) for every non-staff agent. Moved server-side and
 * gated to "signed in AND owns the listing" — not "is staff" — which is
 * the correct requirement here.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec } from "@/lib/d1";
import { loadPlatformConfigFromDb } from "@/services/platformSettings";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    listingId?: string; flashPrice?: number; durationHours?: number;
  } | null;
  if (!body?.listingId || !body.flashPrice || !body.durationHours) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const cfg = await loadPlatformConfigFromDb();
  if (!cfg.features.enableFlashDeals) {
    return NextResponse.json({ error: "Flash deals are not enabled" }, { status: 403 });
  }

  const rows = await d1Query<{ agent_id: string; price: number }>(
    "SELECT agent_id, price FROM listings WHERE id = ?", [body.listingId]
  );
  if (!rows.length) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (rows[0].agent_id !== user.id) {
    return NextResponse.json({ error: "Not your listing" }, { status: 403 });
  }

  const originalPrice = rows[0].price;
  const discountPercent = Math.round(((originalPrice - body.flashPrice) / originalPrice) * 100);
  const maxDiscount = cfg.flashDealMaxDiscountPercent ?? 70;
  const maxHours = cfg.flashDealMaxDurationHours ?? 168;

  if (discountPercent > maxDiscount) {
    return NextResponse.json({ error: `Maximum discount is ${maxDiscount}%` }, { status: 400 });
  }
  if (body.durationHours > maxHours) {
    return NextResponse.json({ error: `Maximum duration is ${maxHours} hours` }, { status: 400 });
  }
  if (body.flashPrice >= originalPrice) {
    return NextResponse.json({ error: "Flash price must be lower than listing price" }, { status: 400 });
  }

  const endsAt = new Date(Date.now() + body.durationHours * 3600 * 1000).toISOString();
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE listings SET is_flash_deal = 1, flash_deal_price = ?, flash_deal_expires_at = ?, updated_at = ? WHERE id = ?",
    [body.flashPrice, endsAt, now, body.listingId]
  );

  return NextResponse.json({ success: true, endsAt });
}

