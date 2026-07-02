/**
 * app/api/listings/mine/route.ts
 * GET /api/listings/mine?agentId=xxx — returns all listings for one agent.
 *
 * ✅ FIX: getMyListings() in services/listings.ts called d1Query() directly
 * from client code. After lib/d1.ts started routing browser D1 calls
 * through the admin/moderator-only proxy at /api/admin/d1, every regular
 * (non-staff) agent got a silent 403 fetching their OWN listings —
 * breaking the dashboard overview, "My Listings", Analytics, Boost,
 * Ad Boost, and Flash Deals pages, plus the public agent profile page,
 * all of which import getMyListings(). Listing data is already public
 * (same info shown on /listings and the listing detail page), so this
 * mirrors the existing public GET /api/listings pattern — open to
 * everyone, not gated to the owner.
 */
import { NextResponse, type NextRequest } from "next/server";
import { d1Query } from "@/lib/d1";
import { LISTING_SELECT, rowToListing, type ListingRow } from "@/services/listings";

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  const rows = await d1Query<ListingRow>(
    `SELECT ${LISTING_SELECT} WHERE l.agent_id = ? ORDER BY l.created_at DESC`,
    [agentId]
  );

  return NextResponse.json({ listings: rows.map(rowToListing) });
}
