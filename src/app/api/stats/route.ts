/**
 * app/api/stats/route.ts
 * GET /api/stats — public platform counts for the homepage.
 *
 * ✅ FIX: fetchPlatformStats() called d1Query() directly from the client
 * homepage component. After the admin-gated D1 proxy was introduced, this
 * silently failed for every non-staff visitor (caught by a .catch(()=>{})
 * with no error shown), leaving the homepage stuck showing "0+ active
 * listings" even when listings existed. These are just aggregate counts
 * (no PII), so this route is intentionally public.
 */
import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";

interface CountRow { cnt: number; }
interface SumRow { total: number | null; }

export async function GET() {
  const [activeListings, totalUsers, verifiedAgents, escrowTotal] = await Promise.all([
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM listings WHERE status = 'active'", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM users", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM users WHERE is_verified = 1", []),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount),0) as total FROM escrows WHERE status IN ('funded','held','inspection','released')", []),
  ]);

  return NextResponse.json({
    activeListings: activeListings[0]?.cnt ?? 0,
    totalUsers: totalUsers[0]?.cnt ?? 0,
    verifiedAgents: verifiedAgents[0]?.cnt ?? 0,
    escrowTotal: escrowTotal[0]?.total ?? 0,
  });
}
