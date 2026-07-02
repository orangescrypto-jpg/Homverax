/**
 * app/api/flash-deals/route.ts
 * GET /api/flash-deals?limit=50 — public list of active flash deals.
 *
 * ✅ FIX: getActiveFlashDeals() in services/flashDeals.ts used to call
 * d1Query() directly. Since lib/d1.ts routes browser-side calls through
 * the admin/moderator-only proxy at /api/admin/d1, every non-staff
 * visitor (including agents on their own Flash Deals dashboard page, and
 * the public /flash-deals page) got a silent 403. On the agent dashboard
 * this made the page fall back to its initial "flashEnabled = false"
 * state — showing "Flash Deals Disabled" even after the admin turned the
 * feature ON, and even for the admin's own account browsing as a regular
 * user. This route does the same DB read server-side and is public (deal
 * data is already shown on /flash-deals to anyone).
 */
import { NextResponse, type NextRequest } from "next/server";
import { d1Query } from "@/lib/d1";

interface FlashDealRow {
  id: string; title: string; price: number; flash_deal_price: number; flash_deal_expires_at: string;
  agent_id: string; category: string; images: string; state: string; lga: string; listing_type: string; price_unit: string;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const pageLimit = Math.min(Number(sp.get("limit")) || 20, 100);
  const now = new Date().toISOString();

  const rows = await d1Query<FlashDealRow>(
    "SELECT id, title, price, flash_deal_price, flash_deal_expires_at, agent_id, category, images, state, lga, listing_type, price_unit FROM listings WHERE is_flash_deal = 1 AND flash_deal_expires_at > ? AND status = 'active' ORDER BY flash_deal_expires_at ASC LIMIT ?",
    [now, pageLimit]
  );

  const deals = rows.map((r) => {
    let images: string[] = [];
    try { images = JSON.parse(r.images || "[]"); } catch {}
    const discountPercent = Math.round(((r.price - r.flash_deal_price) / r.price) * 100);
    return {
      listingId: r.id, listingTitle: r.title, originalPrice: r.price, flashPrice: r.flash_deal_price,
      discountPercent, endsAt: r.flash_deal_expires_at, agentId: r.agent_id,
      category: r.category, images, location: { state: r.state, lga: r.lga },
      listingType: r.listing_type, priceUnit: r.price_unit,
    };
  });

  return NextResponse.json({ deals });
}
