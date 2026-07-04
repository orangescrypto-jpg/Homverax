/**
 * services/offers.ts
 *
 * ✅ FIX: every function here used to call d1Query()/d1Exec() directly from
 * client code. Since lib/d1.ts routes browser D1 calls through the
 * admin/moderator-only proxy at /api/admin/d1, every regular buyer/seller
 * got a 403 on any offer action or lookup — including getAcceptedOffer,
 * which runs on the listing detail page load and showed up as "Failed to
 * load listing" even though the listing itself loaded fine. All functions
 * below now call the dedicated /api/offers server route, keeping the same
 * signatures so no call sites need to change.
 */

export type OfferStatus = "pending" | "accepted" | "rejected" | "countered" | "expired" | "paid";

export interface Offer {
  id: string; listingId: string; listingTitle: string; conversationId?: string;
  buyerId: string; buyerName: string; sellerId: string; sellerName: string;
  proposedPrice: number; originalPrice: number; status: OfferStatus; note?: string;
  counterPrice?: number; counterNote?: string; expiresAt?: string; createdAt: string; updatedAt: string;
}

async function postOffers(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error ?? `Offers API error ${res.status}`);
  }
  return res.json();
}

async function getOffers(params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/offers?${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error ?? `Offers API error ${res.status}`);
  }
  return res.json();
}

export async function createOffer(params: {
  listingId: string; listingTitle: string; conversationId?: string;
  buyerId: string; buyerName: string; sellerId: string; sellerName: string;
  proposedPrice: number; originalPrice: number; note?: string;
}): Promise<Offer> {
  const { offer } = await postOffers({ action: "create", ...params });
  return offer as Offer;
}

export async function acceptOffer(offerId: string): Promise<Offer> {
  const { offer } = await postOffers({ action: "accept", offerId });
  return offer as Offer;
}

export async function rejectOffer(offerId: string, _reason?: string): Promise<Offer> {
  const { offer } = await postOffers({ action: "reject", offerId });
  return offer as Offer;
}

export async function counterOffer(offerId: string, counterPrice: number, counterNote?: string): Promise<Offer> {
  const { offer } = await postOffers({ action: "counter", offerId, counterPrice, counterNote });
  return offer as Offer;
}

export async function markOfferPaid(offerId: string, _escrowId: string): Promise<Offer> {
  const { offer } = await postOffers({ action: "markPaid", offerId });
  return offer as Offer;
}

export async function getOfferById(offerId: string): Promise<Offer | null> {
  const { offer } = await getOffers({ action: "get", offerId });
  return (offer as Offer | null) ?? null;
}

export async function getAcceptedOffer(listingId: string, buyerId: string): Promise<Offer | null> {
  const { offer } = await getOffers({ action: "accepted", listingId, buyerId });
  return (offer as Offer | null) ?? null;
}

export async function getPendingOffer(listingId: string, buyerId: string): Promise<Offer | null> {
  const { offer } = await getOffers({ action: "pending", listingId, buyerId });
  return (offer as Offer | null) ?? null;
}

export async function getOffersForListing(listingId: string): Promise<Offer[]> {
  const { offers } = await getOffers({ action: "forListing", listingId });
  return (offers as Offer[]) ?? [];
}

export async function getMyOffers(buyerId: string): Promise<Offer[]> {
  const { offers } = await getOffers({ action: "mine", buyerId });
  return (offers as Offer[]) ?? [];
}

export async function getReceivedOffers(sellerId: string): Promise<Offer[]> {
  const { offers } = await getOffers({ action: "received", sellerId });
  return (offers as Offer[]) ?? [];
}
