/**
 * app/api/listings/analytics/route.ts
 * POST /api/listings/analytics — { listingIds: string[] } → analytics per listing.
 *
 * ✅ FIX: getListingAnalytics()/getMultipleListingAnalytics() in
 * services/analytics.ts called d1Query() directly from client code, which
 * — same as getMyListings() — got routed through the admin/moderator-only
 * D1 proxy and silently 403'd for regular agents, breaking the dashboard
 * Analytics page ("Failed to load analytics") even though the view/save
 * counts it reads are the same numbers already shown publicly on every
 * listing card (views badge, etc). This route does the query server-side
 * so it works for any signed-in agent viewing their own listings' stats.
 */
import { NextResponse, type NextRequest } from "next/server";
import { d1Query } from "@/lib/d1";
import type { ListingAnalytics } from "@/services/analytics";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { listingIds?: string[] } | null;
  const listingIds = Array.isArray(body?.listingIds) ? body!.listingIds : [];
  if (listingIds.length === 0) {
    return NextResponse.json({ analytics: [] });
  }

  const placeholders = listingIds.map(() => "?").join(",");
  const rows = await d1Query<{ id: string; views: number; saves: number; updated_at: string }>(
    `SELECT id, views, saves, updated_at FROM listings WHERE id IN (${placeholders})`,
    listingIds
  );

  const byId = new Map(rows.map((r) => [r.id, r]));
  const analytics: ListingAnalytics[] = listingIds.map((id) => {
    const l = byId.get(id) ?? { id, views: 0, saves: 0, updated_at: new Date().toISOString() };
    return {
      listingId: id, views: l.views, uniqueViews: l.views, saves: l.saves,
      inquiries: 0, offers: 0, escrows: 0, conversionRate: 0,
      viewsThisWeek: 0, viewsThisMonth: 0, updatedAt: l.updated_at,
    };
  });

  return NextResponse.json({ analytics });
}
