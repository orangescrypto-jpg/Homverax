/**
 * app/api/subscriptions/status/route.ts
 * GET /api/subscriptions/status — the signed-in user's plan status
 * (active listing count, remaining slots, badge/leads eligibility, etc).
 *
 * ✅ FIX: getUserPlanStatus() in services/subscriptions.ts called
 * d1Query() directly from client code, which the admin-gated D1 proxy
 * silently blocked (403) for every non-staff user. That broke:
 *  - the Subscription page (plan comparison table + listing usage bar
 *    render empty, only default "Free / 0-3" placeholder values show),
 *  - the Analytics page (Promise.all rejected, page never loads real
 *    listing analytics for anyone but admin/moderator).
 * This route does the same DB read server-side and is gated to "signed
 * in", not "is staff" — every regular user needs their own plan status.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";
import { loadPlatformConfigFromDb } from "@/services/platformSettings";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const userPlanSlug = sp.get("plan") ?? "free";
  const expiryIso = sp.get("expiry") ?? undefined;

  const cfg = await loadPlatformConfigFromDb();
  const plan = cfg.subscriptionPlans.find((p) => p.slug === userPlanSlug) ?? cfg.subscriptionPlans[0];
  const isActive = userPlanSlug !== "free" && expiryIso ? new Date(expiryIso) > new Date() : userPlanSlug === "free";

  const activeCountRows = await d1Query<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM listings WHERE agent_id = ? AND status = 'active'", [user.id]
  );
  const activeListingCount = activeCountRows[0]?.cnt ?? 0;
  const maxListings = plan.maxListings === 999999 ? Infinity : (plan.maxListings ?? 0);

  return NextResponse.json({
    plan, isActive, canPost: activeListingCount < maxListings,
    activeListingCount, remainingSlots: maxListings === Infinity ? 999 : Math.max(0, maxListings - activeListingCount),
    canAccessLeads: (plan as unknown as { leadsAccess?: boolean }).leadsAccess === true,
    hasVerifiedBadge: userPlanSlug === "pro" || userPlanSlug === "premium",
    expiresAt: expiryIso ?? null,
  });
}
