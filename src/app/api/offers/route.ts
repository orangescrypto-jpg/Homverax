/**
 * app/api/offers/route.ts
 * Server-side proxy for all offer operations.
 *
 * ✅ FIX: services/offers.ts called d1Query()/d1Exec() directly from client
 * code (createOffer, acceptOffer, rejectOffer, counterOffer, markOfferPaid,
 * getAcceptedOffer, getPendingOffer, getOffersForListing, getMyOffers).
 * Since lib/d1.ts routes browser D1 calls through the admin/moderator-only
 * proxy at /api/admin/d1, every regular buyer/seller hit a 403 on any
 * offer action or lookup — including getAcceptedOffer on the listing
 * detail page, which showed as "Failed to load listing". This route runs
 * server-side and talks to D1 directly, same pattern as
 * /api/listings/mine.
 *
 * GET  /api/offers?action=accepted&listingId=..&buyerId=..
 * GET  /api/offers?action=pending&listingId=..&buyerId=..
 * GET  /api/offers?action=forListing&listingId=..
 * GET  /api/offers?action=mine&buyerId=..
 * POST /api/offers  { action: "create"|"accept"|"reject"|"counter"|"markPaid", ...params }
 */
import { NextResponse, type NextRequest } from "next/server";
import { d1Query, d1Exec, newId } from "@/lib/d1";

type OfferStatus = "pending" | "accepted" | "rejected" | "countered" | "expired" | "paid";

interface Offer {
  id: string; listingId: string; listingTitle: string; conversationId?: string;
  buyerId: string; buyerName: string; sellerId: string; sellerName: string;
  proposedPrice: number; originalPrice: number; status: OfferStatus; note?: string;
  counterPrice?: number; counterNote?: string; expiresAt?: string; createdAt: string; updatedAt: string;
}

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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const action = params.get("action");
  const listingId = params.get("listingId") ?? "";
  const buyerId = params.get("buyerId") ?? "";

  switch (action) {
    case "accepted": {
      const all = await getOffersByQuery("listingId", listingId, "accepted");
      return NextResponse.json({ offer: all.find((o) => o.buyerId === buyerId) ?? null });
    }
    case "pending": {
      const all = await getOffersByQuery("listingId", listingId, "pending");
      return NextResponse.json({ offer: all.find((o) => o.buyerId === buyerId) ?? null });
    }
    case "forListing": {
      const offers = await getOffersByQuery("listingId", listingId);
      return NextResponse.json({ offers });
    }
    case "mine": {
      const offers = await getOffersByQuery("buyerId", buyerId);
      return NextResponse.json({ offers });
    }
    default:
      return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { action, offerId } = body as { action?: string; offerId?: string };

  switch (action) {
    case "create": {
      const { listingId, listingTitle, conversationId, buyerId, buyerName, sellerId, sellerName, proposedPrice, originalPrice, note } = body;
      if (!listingId || !buyerId || !sellerId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      const id = newId();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const offer: Offer = {
        id, listingId, listingTitle, conversationId, buyerId, buyerName, sellerId, sellerName,
        proposedPrice, originalPrice, status: "pending", note, expiresAt, createdAt: now, updatedAt: now,
      };
      await saveOffer(offer);
      return NextResponse.json({ offer });
    }
    case "accept": {
      if (!offerId) return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
      const offer = await loadOffer(offerId);
      if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      await saveOffer({ ...offer, status: "accepted", updatedAt: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }
    case "reject": {
      if (!offerId) return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
      const offer = await loadOffer(offerId);
      if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      await saveOffer({ ...offer, status: "rejected", updatedAt: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }
    case "counter": {
      const { counterPrice, counterNote } = body;
      if (!offerId) return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
      const offer = await loadOffer(offerId);
      if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      await saveOffer({ ...offer, status: "countered", counterPrice, counterNote: counterNote ?? "", updatedAt: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }
    case "markPaid": {
      if (!offerId) return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
      const offer = await loadOffer(offerId);
      if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      await saveOffer({ ...offer, status: "paid", updatedAt: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  }
}
