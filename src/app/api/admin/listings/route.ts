/**
 * app/api/admin/listings/route.ts
 * GET /api/admin/listings — returns all listings for the admin "Manage
 * Listings" page. d1Query() needs CF_ACCOUNT_ID / CF_D1_DATABASE_ID /
 * CF_API_TOKEN, which are server-only secrets and are always undefined in
 * the browser, so this must be called from a server route rather than
 * directly from the client page.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";
import { LISTING_SELECT, rowToListing, type ListingRow } from "@/services/listings";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user.user_metadata?.role as string | undefined) ?? "";
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const pageLimit = Math.min(Number(limitParam) || 200, 500);

  const rows = await d1Query<ListingRow>(
    `SELECT ${LISTING_SELECT} ORDER BY l.created_at DESC LIMIT ?`,
    [pageLimit]
  );

  return NextResponse.json({ listings: rows.map(rowToListing) });
}
