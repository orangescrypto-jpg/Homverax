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

// ✅ FIX: listing creation does several sequential network calls (D1 plan
// lookup, D1 insert, D1 select-back) after the image has already been
// uploaded. On a slow mobile connection this can run past Vercel's default
// serverless function timeout (10s on Hobby plans), which kills the
// connection mid-request — the browser then reports a raw "Failed to
// fetch" with no useful error message. This raises the allowed duration.
// Note: the Hobby plan hard-caps this at 60s regardless of the value set
// here; upgrading to Pro allows higher ceilings if still not enough.
export const maxDuration = 60;

// ✅ FIX: searchListings() (used by the main /listings browse page and the
// homepage) called d1Query() directly from the client. After lib/d1.ts
// started routing browser D1 calls through the admin/moderator-only
// proxy, this meant EVERY regular visitor — anyone not logged in as
// staff — got silently blocked from browsing listings at all. Browsing
// must never require authentication. This GET handler is fully public.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const pageLimit = Math.min(Number(sp.get("limit")) || 12, 50);

  const conditions: string[] = ["l.status = 'active'"];
  const params: unknown[] = [];

  const category = sp.get("category");
  const state = sp.get("state");
  const propertyType = sp.get("propertyType");
  const listingType = sp.get("listingType");
  const verifiedOnly = sp.get("verifiedOnly");
  const furnished = sp.get("furnished");
  const minPrice = sp.get("minPrice");
  const maxPrice = sp.get("maxPrice");
  const bedrooms = sp.get("bedrooms");
  const query = sp.get("query");

  if (category)     { conditions.push("l.category = ?");      params.push(category); }
  if (state)        { conditions.push("l.state = ?");          params.push(state); }
  if (propertyType) { conditions.push("l.property_type = ?");  params.push(propertyType); }
  if (listingType)  { conditions.push("l.listing_type = ?");   params.push(listingType); }
  if (verifiedOnly === "true") { conditions.push("l.is_property_verified = 1"); }
  if (furnished !== null) { conditions.push("l.furnished = ?"); params.push(furnished === "true" ? 1 : 0); }
  if (minPrice) { conditions.push("l.price >= ?"); params.push(Number(minPrice)); }
  if (maxPrice) { conditions.push("l.price <= ?"); params.push(Number(maxPrice)); }
  if (bedrooms)  { conditions.push("l.bedrooms >= ?"); params.push(Number(bedrooms)); }
  if (query) {
    const q = `%${query}%`;
    conditions.push("(l.title LIKE ? OR l.description LIKE ? OR l.address LIKE ? OR l.state LIKE ?)");
    params.push(q, q, q, q);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const fetchLimit = (pageLimit + 1) * 3;
  params.push(fetchLimit);

  const rows = await d1Query<ListingRow>(
    `SELECT ${LISTING_SELECT} ${where} ORDER BY l.created_at DESC LIMIT ?`,
    params
  );

  let items = rows.map(rowToListing);

  const getScore = (l: any): number => {
    let score = 0;
    if (l.boostType === "top_placement") score += 1000;
    if (l.boostType === "featured")      score += 500;
    if (l.boostType === "urgent")        score += 50;
    score += (l.agentRankBoost ?? 0) * 100;
    return score;
  };
  items.sort((a, b) => getScore(b) - getScore(a));

  const hasMore = items.length > pageLimit;
  const page = Number(sp.get("page")) || 0;

  return NextResponse.json({
    data: items.slice(0, pageLimit),
    total: items.length,
    page,
    limit: pageLimit,
    totalPages: hasMore ? page + 2 : page + 1,
  });
}

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
