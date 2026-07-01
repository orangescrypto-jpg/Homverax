/**
 * app/api/listings/route.ts
 * POST /api/listings — creates a new listing.
 *
 * ✅ FIX: createListing() in services/listings.ts used to call d1Query()/
 * d1Exec() directly. Since services/listings.ts is imported by client
 * components, and d1Query()/d1Exec() route browser calls through the
 * admin/moderator-only proxy at /api/admin/d1, this meant ANY non-admin
 * agent or landlord got a silent 403 trying to publish a listing — the
 * exact feature every regular user actually needs. It also meant listing
 * creation traffic was going through a URL containing "/api/admin/",
 * which some mobile carriers/VPNs filter, causing raw "Failed to fetch"
 * errors client-side with no useful message.
 *
 * This route does the same DB work server-side, gated only to "signed in",
 * not "is staff" — the correct requirement for creating a listing.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { LISTING_SELECT, rowToListing, type ListingRow } from "@/services/listings";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.data) {
    return NextResponse.json({ error: "Missing listing data" }, { status: 400 });
  }
  const data = body.data;
  // Images are uploaded separately via /api/upload before this call, so
  // `data.images` here is already an array of final URLs, not File objects.
  const images: string[] = Array.isArray(data.images) ? data.images : [];

  const id = newId();
  const now = new Date().toISOString();

  const agentRows = await d1Query<{ subscription_plan: string }>(
    "SELECT subscription_plan FROM users WHERE id = ?",
    [user.id]
  );
  const plan = agentRows[0]?.subscription_plan ?? "free";
  const RANK_BOOSTS: Record<string, number> = { free: 0, basic: 0, pro: 2, premium: 5 };
  const agentRankBoost = RANK_BOOSTS[plan] ?? 0;

  await d1Exec(
    `INSERT INTO listings
      (id, agent_id, title, description, category, property_type, listing_type,
       price, price_unit, state, lga, address, latitude, longitude,
       bedrooms, bathrooms, toilets, parking_spaces, area_sq_m, furnished,
       images, video_url, virtual_tour_url, boost_type, is_property_verified,
       is_featured, agent_rank_boost, status, views, saves, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      user.id, // ✅ use the authenticated user's id server-side, not a client-supplied agentId
      data.title,
      data.description ?? null,
      data.category ?? null,
      data.propertyType ?? null,
      data.listingType ?? null,
      data.price ?? null,
      data.priceUnit ?? null,
      data.location?.state ?? null,
      data.location?.lga ?? null,
      data.location?.address ?? null,
      data.location?.latitude ?? null,
      data.location?.longitude ?? null,
      data.bedrooms ?? null,
      data.bathrooms ?? null,
      data.toilets ?? null,
      data.parkingSpaces ?? null,
      data.areaSqM ?? null,
      data.furnished ? 1 : 0,
      JSON.stringify(images),
      data.videoUrl ?? null,
      data.virtualTourUrl ?? null,
      data.boostType ?? "none",
      data.isPropertyVerified ? 1 : 0,
      data.isFeatured ? 1 : 0,
      agentRankBoost,
      "active",
      0,
      0,
      now,
      now,
    ]
  );

  const rows = await d1Query<ListingRow>(`SELECT ${LISTING_SELECT} WHERE l.id = ?`, [id]);
  return NextResponse.json({ listing: rowToListing(rows[0]) });
}
