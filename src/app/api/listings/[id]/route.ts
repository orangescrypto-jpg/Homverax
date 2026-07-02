/**
 * app/api/listings/[id]/route.ts
 * PATCH/DELETE /api/listings/[id]
 *
 * ✅ FIX: updateListing()/deleteListing() in services/listings.ts called
 * d1Query()/d1Exec() directly from client code. After lib/d1.ts was fixed
 * to route browser calls through the admin/moderator-only proxy at
 * /api/admin/d1, this meant a regular agent editing or deleting their OWN
 * listing got silently blocked with "Forbidden" — only admins could
 * successfully save an edit. On top of that, ownership was only checked
 * client-side (in the edit page's UI), never enforced server-side, so
 * even before that regression, nothing actually stopped one signed-in
 * user from editing/deleting another user's listing via a direct API
 * call. This route fixes both: it's open to any signed-in user, but only
 * lets them modify a listing if they own it (or they're admin/moderator).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec } from "@/lib/d1";
import { LISTING_SELECT, rowToListing, type ListingRow } from "@/services/listings";

async function getAuthorizedListing(request: NextRequest, id: string) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const rows = await d1Query<{ agent_id: string }>("SELECT agent_id FROM listings WHERE id = ?", [id]);
  if (!rows.length) return { error: NextResponse.json({ error: "Listing not found" }, { status: 404 }) };

  const role = (user.user_metadata?.role as string | undefined) ?? "";
  const isOwner = rows[0].agent_id === user.id;
  const isStaff = role === "admin" || role === "moderator";
  if (!isOwner && !isStaff) {
    return { error: NextResponse.json({ error: "Not authorized to modify this listing" }, { status: 403 }) };
  }
  return { user, isStaff };
}

// ✅ FIX: getListingById() (used by every listing detail page) also called
// d1Query()/d1Exec() directly from the client — same public-access
// regression as searchListings. This handler is intentionally public.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await d1Query<ListingRow>(`SELECT ${LISTING_SELECT} WHERE l.id = ?`, [id]);
  if (!rows.length) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const now = new Date().toISOString();
  d1Exec("UPDATE listings SET views = views + 1, updated_at = ? WHERE id = ?", [now, id]).catch(() => {});

  return NextResponse.json({ listing: rowToListing(rows[0]) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthorizedListing(request, id);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const data = body?.data;
  if (!data) return NextResponse.json({ error: "Missing update data" }, { status: 400 });

  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  const map: Record<string, [string, unknown]> = {
    title: ["title = ?", data.title],
    description: ["description = ?", data.description],
    category: ["category = ?", data.category],
    propertyType: ["property_type = ?", data.propertyType],
    listingType: ["listing_type = ?", data.listingType],
    price: ["price = ?", data.price],
    priceUnit: ["price_unit = ?", data.priceUnit],
    bedrooms: ["bedrooms = ?", data.bedrooms],
    bathrooms: ["bathrooms = ?", data.bathrooms],
    toilets: ["toilets = ?", data.toilets],
    parkingSpaces: ["parking_spaces = ?", data.parkingSpaces],
    areaSqM: ["area_sq_m = ?", data.areaSqM],
    videoUrl: ["video_url = ?", data.videoUrl],
    status: ["status = ?", data.status],
  };
  for (const key of Object.keys(map)) {
    if (data[key] !== undefined) { fields.push(map[key][0]); values.push(map[key][1]); }
  }
  if (data.furnished !== undefined) { fields.push("furnished = ?"); values.push(data.furnished ? 1 : 0); }
  if (data.images !== undefined) { fields.push("images = ?"); values.push(JSON.stringify(data.images)); }
  if (data.location?.state !== undefined) { fields.push("state = ?"); values.push(data.location.state); }
  if (data.location?.lga !== undefined) { fields.push("lga = ?"); values.push(data.location.lga); }
  if (data.location?.address !== undefined) { fields.push("address = ?"); values.push(data.location.address); }
  if (data.location?.latitude !== undefined) { fields.push("latitude = ?"); values.push(data.location.latitude); }
  if (data.location?.longitude !== undefined) { fields.push("longitude = ?"); values.push(data.location.longitude); }
  // boostType/boostExpiresAt: only staff can set these directly (regular
  // owners get boosts only through the paid approval flow).
  if (auth.isStaff) {
    if (data.boostType !== undefined) { fields.push("boost_type = ?"); values.push(data.boostType); }
    if (data.boostExpiresAt !== undefined) { fields.push("boost_expires_at = ?"); values.push(data.boostExpiresAt); }
    if (data.isPropertyVerified !== undefined) { fields.push("is_property_verified = ?"); values.push(data.isPropertyVerified ? 1 : 0); }
    if (data.isFeatured !== undefined) { fields.push("is_featured = ?"); values.push(data.isFeatured ? 1 : 0); }
  }

  values.push(id);
  await d1Exec(`UPDATE listings SET ${fields.join(", ")} WHERE id = ?`, values);

  const rows = await d1Query<ListingRow>(`SELECT ${LISTING_SELECT} WHERE l.id = ?`, [id]);
  return NextResponse.json({ listing: rowToListing(rows[0]) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthorizedListing(request, id);
  if (auth.error) return auth.error;

  await d1Exec("DELETE FROM listings WHERE id = ?", [id]);
  return NextResponse.json({ success: true });
}
