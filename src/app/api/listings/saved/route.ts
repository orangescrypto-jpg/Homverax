/**
 * app/api/listings/saved/route.ts
 * GET  /api/listings/saved?userId=xxx&listingId=yyy  -> { saved: boolean }
 * GET  /api/listings/saved?userId=xxx                -> { listings: PropertyListing[] }
 * POST /api/listings/saved  { userId, listingId, action: "save" | "unsave" }
 *
 * ✅ FIX: isListingSaved() and getSavedListings() in services/listings.ts
 * called d1Query() directly from client code. Since lib/d1.ts routes
 * browser-side D1 calls through the admin/moderator-only proxy at
 * /api/admin/d1, every regular signed-in buyer got a 403 just from
 * opening a listing detail page (isListingSaved runs on load), which
 * bubbled up through the page's shared try/catch as "Failed to load
 * listing" even though the listing itself loaded fine. This route runs
 * server-side and talks to D1 directly, same pattern as
 * /api/listings/mine.
 */
import { NextResponse, type NextRequest } from "next/server";
import { d1Query, d1Exec } from "@/lib/d1";
import { LISTING_SELECT, rowToListing, type ListingRow } from "@/services/listings";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const listingId = request.nextUrl.searchParams.get("listingId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  if (listingId) {
    const rows = await d1Query<{ id: string }>(
      "SELECT id FROM saved_listings WHERE id = ?",
      [`${userId}_${listingId}`]
    );
    return NextResponse.json({ saved: rows.length > 0 });
  }

  const rows = await d1Query<ListingRow>(
    `SELECT ${LISTING_SELECT}
     INNER JOIN saved_listings sl ON sl.listing_id = l.id
     WHERE sl.user_id = ?
     ORDER BY sl.created_at DESC`,
    [userId]
  );
  return NextResponse.json({ listings: rows.map(rowToListing) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { userId, listingId, action } = body as {
    userId?: string; listingId?: string; action?: "save" | "unsave";
  };

  if (!userId || !listingId || !action) {
    return NextResponse.json({ error: "Missing userId, listingId, or action" }, { status: 400 });
  }

  const id = `${userId}_${listingId}`;

  if (action === "save") {
    await d1Exec(
      "INSERT OR IGNORE INTO saved_listings (id, user_id, listing_id, created_at) VALUES (?, ?, ?, ?)",
      [id, userId, listingId, new Date().toISOString()]
    );
    await d1Exec("UPDATE listings SET saves = saves + 1 WHERE id = ?", [listingId]);
  } else {
    await d1Exec("DELETE FROM saved_listings WHERE id = ?", [id]);
    await d1Exec("UPDATE listings SET saves = MAX(0, saves - 1) WHERE id = ?", [listingId]);
  }

  return NextResponse.json({ success: true });
}
