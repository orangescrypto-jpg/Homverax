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

// ✅ FIX: was calling d1Query() directly from the client homepage, which —
// after the admin-gated D1 proxy was introduced — silently failed for
// every regular visitor. Now calls a public stats route.
export async function fetchPlatformStats(): Promise<PlatformStats> {
  const res = await fetch("/api/stats", { cache: "no-store" });
  if (!res.ok) {
    return { activeListings: 0, totalUsers: 0, verifiedAgents: 0, escrowTotal: 0 };
  }
  return res.json();
}
