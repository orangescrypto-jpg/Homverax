/**
 * services/flashDeals.ts — client-side wrapper.
 *
 * ✅ FIX: every function here used to call d1Query()/d1Exec() directly.
 * Since lib/d1.ts routes browser calls through the admin/moderator-only
 * proxy at /api/admin/d1, this silently 403'd for every non-staff user —
 * including agents on their own Flash Deals dashboard page, which fell
 * back to "Flash Deals Disabled" even after the admin enabled the
 * feature (the getPlatformConfig() call succeeded, but the parallel
 * getActiveFlashDeals() call in the same Promise.all rejected, so the
 * whole .then() block — including setFlashEnabled(true) — never ran).
 * Now routed through dedicated server endpoints: GET /api/flash-deals is
 * public (deal data already appears on /flash-deals to anyone), and
 * POST /api/flash-deals/set and /remove are gated to "signed in +
 * owns the listing", not "is staff".
 */

export interface FlashDeal {
  listingId: string; listingTitle: string; originalPrice: number; flashPrice: number;
  discountPercent: number; endsAt: string; agentId: string;
  category?: string; images?: string[]; location?: { state: string; lga?: string };
  listingType?: string; priceUnit?: string;
}

export async function setFlashDeal(params: {
  listingId: string; agentId: string; flashPrice: number; durationHours: number;
}): Promise<void> {
  const res = await fetch("/api/flash-deals/set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: params.listingId,
      flashPrice: params.flashPrice,
      durationHours: params.durationHours,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to create flash deal");
  }
}

export async function removeFlashDeal(listingId: string, agentId: string): Promise<void> {
  const res = await fetch("/api/flash-deals/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to remove deal");
  }
}

export async function getActiveFlashDeals(pageLimit = 20): Promise<FlashDeal[]> {
  const res = await fetch(`/api/flash-deals?limit=${pageLimit}`, { cache: "no-store" });
  if (!res.ok) return [];
  const { deals } = await res.json();
  return deals as FlashDeal[];
}
