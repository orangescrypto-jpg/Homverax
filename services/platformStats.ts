/**
 * services/platformStats.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */

import { d1Query } from "@/lib/d1";

export interface PlatformStats {
  activeListings: number;
  totalUsers: number;
  verifiedAgents: number;
  escrowTotal: number;
}

interface CountRow { cnt: number; }
interface SumRow { total: number | null; }

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const [activeListings, totalUsers, verifiedAgents, escrowTotal] = await Promise.all([
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM listings WHERE status = 'active'", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM users", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM users WHERE is_verified = 1", []),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount),0) as total FROM escrows WHERE status IN ('funded','held','inspection','released')", []),
  ]);

  return {
    activeListings: activeListings[0]?.cnt ?? 0,
    totalUsers: totalUsers[0]?.cnt ?? 0,
    verifiedAgents: verifiedAgents[0]?.cnt ?? 0,
    escrowTotal: escrowTotal[0]?.total ?? 0,
  };
}
