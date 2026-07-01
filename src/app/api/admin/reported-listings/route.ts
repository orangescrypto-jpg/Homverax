/**
 * app/api/admin/reported-listings/route.ts
 * GET /api/admin/reported-listings — returns listings with status
 * 'reported' for the admin Reports page. Same rationale as
 * /api/admin/listings: d1Query() needs server-only Cloudflare secrets and
 * cannot be called directly from a client component.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";
import { LISTING_SELECT, rowToListing, type ListingRow } from "@/services/listings";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user.user_metadata?.role as string | undefined) ?? "";
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = await d1Query<ListingRow>(
      `SELECT ${LISTING_SELECT} WHERE l.status = 'reported' ORDER BY l.updated_at DESC`,
      []
    );
    return NextResponse.json({ listings: rows.map(rowToListing) });
  } catch {
    return NextResponse.json({ listings: [] });
  }
}
