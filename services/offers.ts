/**
 * services/offers.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";

export type OfferStatus = "pending" | "accepted" | "rejected" | "countered" | "expired" | "paid";

export interface Offer {
  id: string; listingId: string; listingTitle: string; conversationId?: string;
  buyerId: string; buyerName: string; sellerId: string; sellerName: string;
  proposedPrice: number; originalPrice: number; status: OfferStatus; note?: string;
  counterPrice?: number; counterNote?: string; expiresAt?: string; createdAt: string; updatedAt: string;
}

// Offers stored in platform_settings as JSON keyed by offerId
async function loadOffer(offerId: string): Promise<Offer | null> {
  const rows = await d1Query<{ value: string }>(
    "SELECT value FROM platform_settings WHERE key = ?", [`offer:${offerId}`]
  );
  if (!rows.length) return null;
  try { return JSON.parse(rows[0].value) as Offer; } catch { return null; }
}

async function saveOffer(offer: Offer): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [`offer:${offer.id}`, JSON.stringify(offer), now]
  );
}

export async function createOffer(params: {
  listingId: string; listingTitle: string; conversationId?: string;
  buyerId: string; buyerName: string; sellerId: string; sellerName: string;
  proposedPrice: number; originalPrice: number; note?: string;
}): Promise<Offer> {
  const id = newId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const offer: Offer = { ...params, id, status: "pending", expiresAt, createdAt: now, updatedAt: now };
  await saveOffer(offer);
  return offer;
}

export async function acceptOffer(offerId: string): Promise<void> {
  const offer = await loadOffer(offerId);
  if (!offer) return;
  await saveOffer({ ...offer, status: "accepted", updatedAt: new Date().toISOString() });
}

export async function rejectOffer(offerId: string, _reason?: string): Promise<void> {
  const offer = await loadOffer(offerId);
  if (!offer) return;
  await saveOffer({ ...offer, status: "rejected", updatedAt: new Date().toISOString() });
}

export async function counterOffer(offerId: string, counterPrice: number, counterNote?: string): Promise<void> {
  const offer = await loadOffer(offerId);
  if (!offer) return;
  await saveOffer({ ...offer, status: "countered", counterPrice, counterNote: counterNote ?? "", updatedAt: new Date().toISOString() });
}

export async function markOfferPaid(offerId: string, _escrowId: string): Promise<void> {
  const offer = await loadOffer(offerId);
  if (!offer) return;
  await saveOffer({ ...offer, status: "paid", updatedAt: new Date().toISOString() });
}

async function getOffersByQuery(field: string, value: string, status?: OfferStatus): Promise<Offer[]> {
  const rows = await d1Query<{ key: string; value: string }>(
    "SELECT key, value FROM platform_settings WHERE key LIKE 'offer:%'", []
  );
  const offers: Offer[] = [];
  for (const row of rows) {
    try {
      const o = JSON.parse(row.value) as Offer;
      const matches = field === "buyerId" ? o.buyerId === value : field === "sellerId" ? o.sellerId === value : o.listingId === value;
      if (matches && (!status || o.status === status)) offers.push(o);
    } catch {}
  }
  return offers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAcceptedOffer(listingId: string, buyerId: string): Promise<Offer | null> {
  const all = await getOffersByQuery("listingId", listingId, "accepted");
  return all.find((o) => o.buyerId === buyerId) ?? null;
}

export async function getPendingOffer(listingId: string, buyerId: string): Promise<Offer | null> {
  const all = await getOffersByQuery("listingId", listingId, "pending");
  return all.find((o) => o.buyerId === buyerId) ?? null;
}

export async function getOffersForListing(listingId: string): Promise<Offer[]> {
  return getOffersByQuery("listingId", listingId);
}

export async function getMyOffers(buyerId: string): Promise<Offer[]> {
  return getOffersByQuery("buyerId", buyerId);
}
