/**
 * services/listings.ts
 *
 * All listing CRUD and queries — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */

import { d1Query, d1Exec, newId } from "@/lib/d1";
import { uploadListingImages as storageUploadListingImages } from "@/services/storage";
import type { PropertyListing, ListingFilters, PaginatedResponse } from "@/types";

// ✅ FIX: shared expiry check — a boost with a past boost_expires_at is
// treated as inactive everywhere, without needing a background job to
// physically reset the row.
export function isBoostExpired(boostType: string | null, boostExpiresAt: string | null): boolean {
  if (!boostType || boostType === "none") return false;
  if (!boostExpiresAt) return false; // no expiry set = doesn't expire (e.g. legacy/manual admin boosts)
  return new Date(boostExpiresAt).getTime() < Date.now();
}

// ✅ FIX: flash deal expiry check, mirroring isBoostExpired — a flash deal
// with a past flash_deal_expires_at is treated as inactive everywhere.
export function isFlashDealExpired(isFlashDeal: number | boolean, flashDealExpiresAt: string | null): boolean {
  if (!isFlashDeal) return true;
  if (!flashDealExpiresAt) return true;
  return new Date(flashDealExpiresAt).getTime() < Date.now();
}


// ─── Row from D1 listings table ───────────────────────────────────────────────
// Exported so server-only API routes (e.g. /api/admin/listings) can reuse the
// same row shape and mapping logic instead of duplicating it.
export interface ListingRow {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  category: string | null;
  property_type: string | null;
  listing_type: string | null;
  price: number | null;
  price_unit: string | null;
  state: string | null;
  lga: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  parking_spaces: number | null;
  area_sq_m: number | null;
  furnished: number | null;
  images: string;
  video_url: string | null;
  virtual_tour_url: string | null;
  boost_type: string | null;
  boost_expires_at: string | null;
  is_property_verified: number;
  is_featured: number;
  is_flash_deal: number;
  flash_deal_price: number | null;
  flash_deal_expires_at: string | null;
  agent_rank_boost: number;
  status: string;
  views: number;
  saves: number;
  created_at: string;
  updated_at: string;
  // joined from users table
  agent_name?: string;
  agent_avatar?: string;
  agent_verified?: number;
  agent_phone?: string;
}

export function rowToListing(row: ListingRow): PropertyListing {
  let images: string[] = [];
  try { images = JSON.parse(row.images || "[]"); } catch { images = []; }

  return {
    id: row.id,
    agentId: row.agent_id,
    agent: {
      id: row.agent_id,
      name: row.agent_name ?? "",
      avatarUrl: row.agent_avatar ?? undefined,
      isVerified: (row.agent_verified ?? 0) === 1,
      phone: row.agent_phone ?? undefined,
    },
    title: row.title,
    description: row.description ?? "",
    category: (row.category as PropertyListing["category"]) ?? "housing",
    propertyType: (row.property_type as PropertyListing["propertyType"]) ?? "apartment",
    listingType: (row.listing_type as PropertyListing["listingType"]) ?? "rent",
    price: row.price ?? 0,
    priceUnit: (row.price_unit as PropertyListing["priceUnit"]) ?? "per_month",
    location: {
      state: row.state ?? "",
      lga: row.lga ?? "",
      address: row.address ?? "",
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
    },
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms ?? undefined,
    toilets: row.toilets ?? undefined,
    parkingSpaces: row.parking_spaces ?? undefined,
    areaSqM: row.area_sq_m ?? undefined,
    furnished: row.furnished === 1,
    images,
    videoUrl: row.video_url ?? undefined,
    virtualTourUrl: row.virtual_tour_url ?? undefined,
    // ✅ FIX: boosts never expired anywhere in the app — there was no
    // boost_expires_at tracking at all. Rather than requiring a cron job to
    // sweep expired boosts, treat an expired boost as "none" right here at
    // read time. This alone makes every part of the app (ranking, badges,
    // dashboard) correctly stop treating an expired boost as active,
    // without needing a background job.
    boostType: isBoostExpired(row.boost_type, row.boost_expires_at)
      ? "none"
      : (row.boost_type as PropertyListing["boostType"]) ?? "none",
    boostExpiresAt: row.boost_expires_at ?? undefined,
    isPropertyVerified: row.is_property_verified === 1,
    isFeatured: row.is_featured === 1,
    // ✅ FIX: is_flash_deal/flash_deal_price/flash_deal_expires_at existed on
    // the D1 row but were never mapped onto PropertyListing, so flash deals
    // never appeared anywhere except the dedicated /flash-deals page (which
    // reads them via a separate route). Also treat an expired flash deal as
    // inactive at read time, same pattern as isBoostExpired above.
    isFlashDeal: !isFlashDealExpired(row.is_flash_deal, row.flash_deal_expires_at),
    flashDealPrice: row.flash_deal_price ?? undefined,
    flashDealExpiresAt: row.flash_deal_expires_at ?? undefined,
    status: (row.status as PropertyListing["status"]) ?? "active",
    viewsCount: row.views ?? 0,
    inquiriesCount: 0,
    savedCount: row.saves ?? 0,
    tags: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const LISTING_SELECT = `
  l.*,
  u.name AS agent_name,
  u.avatar_url AS agent_avatar,
  u.is_verified AS agent_verified,
  u.phone AS agent_phone
  FROM listings l
  LEFT JOIN users u ON u.id = l.agent_id
`;

// ─── Upload images to R2 ──────────────────────────────────────────────────────
export async function uploadListingImages(
  files: File[],
  listingId: string
): Promise<string[]> {
  return storageUploadListingImages(listingId, files);
}

// ─── Create listing ───────────────────────────────────────────────────────────
// ✅ FIX: was calling d1Query()/d1Exec() directly from the client, which
// (via the admin/moderator-only proxy in lib/d1.ts) blocked every regular
// agent/landlord from publishing a listing at all, and routed the request
// through a "/api/admin/" URL that some mobile networks filter, surfacing
// as "Failed to fetch". Upload images first, then hit a dedicated,
// any-signed-in-user route that does the DB write server-side.
export async function createListing(
  data: Omit<PropertyListing, "id" | "createdAt" | "updatedAt" | "viewsCount" | "inquiriesCount" | "savedCount">,
  imageFiles: File[]
): Promise<PropertyListing> {
  let images = data.images ?? [];
  if (imageFiles.length > 0) {
    images = await storageUploadListingImages(newId(), imageFiles);
  }

  const res = await fetch("/api/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { ...data, images } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to create listing");
  }

  const { listing } = await res.json();
  return listing as PropertyListing;
}

// ─── Get single listing ───────────────────────────────────────────────────────
// ✅ FIX: was calling d1Query()/d1Exec() directly from the client, which
// blocked every non-staff visitor from viewing a listing at all once the
// admin-gated D1 proxy was introduced. Now a public route.
export async function getListingById(id: string): Promise<PropertyListing | null> {
  const res = await fetch(`/api/listings/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const { listing } = await res.json();
  return listing as PropertyListing;
}

// ─── Search / filter listings ─────────────────────────────────────────────────
// ✅ FIX: was calling d1Query() directly from the client, which — after the
// admin-gated D1 proxy was introduced — silently blocked every regular
// visitor (anyone not logged in as staff) from browsing listings at all.
// Browsing must never require authentication; now calls a public route.
export async function searchListings(
  filters: ListingFilters
): Promise<PaginatedResponse<PropertyListing>> {
  const sp = new URLSearchParams();
  if (filters.limit !== undefined)        sp.set("limit", String(filters.limit));
  if (filters.page !== undefined)         sp.set("page", String(filters.page));
  if (filters.category)                   sp.set("category", filters.category);
  if (filters.state)                      sp.set("state", filters.state);
  if (filters.propertyType)               sp.set("propertyType", filters.propertyType);
  if (filters.listingType)                sp.set("listingType", filters.listingType);
  if (filters.verifiedOnly)               sp.set("verifiedOnly", "true");
  if (filters.furnished !== undefined)    sp.set("furnished", String(filters.furnished));
  if (filters.minPrice !== undefined)     sp.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined)     sp.set("maxPrice", String(filters.maxPrice));
  if (filters.bedrooms !== undefined)     sp.set("bedrooms", String(filters.bedrooms));
  if (filters.query)                      sp.set("query", filters.query);
  if (filters.boostType)                  sp.set("boostType", filters.boostType);

  const res = await fetch(`/api/listings?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    return { data: [], total: 0, page: filters.page ?? 0, limit: filters.limit ?? 12, totalPages: 1 };
  }
  return res.json();
}

// ─── Get listings by agent ────────────────────────────────────────────────────
export async function getMyListings(agentId: string): Promise<PropertyListing[]> {
  const res = await fetch(`/api/listings/mine?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" });
  if (!res.ok) return [];
  const { listings } = await res.json();
  return listings as PropertyListing[];
}

// ─── Update listing ───────────────────────────────────────────────────────────
// ✅ FIX: was building the UPDATE SQL and calling d1Exec() directly from
// client code, which (a) got blocked for non-admins by the admin-gated D1
// proxy, and (b) had no server-side ownership check at all — anything
// calling this with any listing id could edit it. Now routed through
// /api/listings/[id], which enforces "must own this listing, or be staff"
// server-side.
export async function updateListing(
  id: string,
  updates: Partial<PropertyListing>
): Promise<void> {
  const res = await fetch(`/api/listings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: updates }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to update listing");
  }
}

// ─── Delete listing ───────────────────────────────────────────────────────────
export async function deleteListing(id: string): Promise<void> {
  const res = await fetch(`/api/listings/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to delete listing");
  }
}

// ─── Save / unsave listing ────────────────────────────────────────────────────
// ✅ FIX: these used to call d1Exec/d1Query directly from client code, which
// goes through the admin/moderator-only /api/admin/d1 proxy and 403s for
// regular signed-in users (isListingSaved runs on every listing detail page
// load, so this showed up as "Failed to load listing"). Now routed through
// the dedicated /api/listings/saved server route.
export async function saveListing(userId: string, listingId: string): Promise<void> {
  await fetch("/api/listings/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, listingId, action: "save" }),
  });
}

export async function unsaveListing(userId: string, listingId: string): Promise<void> {
  await fetch("/api/listings/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, listingId, action: "unsave" }),
  });
}

export async function isListingSaved(userId: string, listingId: string): Promise<boolean> {
  const res = await fetch(`/api/listings/saved?userId=${encodeURIComponent(userId)}&listingId=${encodeURIComponent(listingId)}`);
  if (!res.ok) return false;
  const { saved } = await res.json();
  return !!saved;
}

export async function getSavedListings(userId: string): Promise<PropertyListing[]> {
  const res = await fetch(`/api/listings/saved?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) return [];
  const { listings } = await res.json();
  return (listings ?? []) as PropertyListing[];
}

// ─── Apply boost ──────────────────────────────────────────────────────────────
export async function applyBoost(
  listingId: string,
  boostType: PropertyListing["boostType"],
  durationDays?: number
): Promise<void> {
  const now = new Date().toISOString();
  // ✅ FIX: boosts previously had no expiry at all — once set they stayed
  // "active" forever with no way for the system to know it had lapsed.
  const expiresAt = durationDays
    ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  await d1Exec(
    "UPDATE listings SET boost_type = ?, boost_expires_at = ?, updated_at = ? WHERE id = ?",
    [boostType, expiresAt, now, listingId]
  );
}

// ─── Admin: get all listings ──────────────────────────────────────────────────
// ✅ FIX: This used to call d1Query() directly, but d1Query() needs
// CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN — server-only secrets
// that are always undefined in the browser. Since this function is called
// from the client-side admin "Manage Listings" page, it always threw
// "Missing Cloudflare D1 environment variables" and surfaced as
// "Failed to load listings". Route through the server API instead, same
// pattern as the rest of the app (see /api/auth/me).
export async function getAllListingsAdmin(pageLimit = 200): Promise<PropertyListing[]> {
  const res = await fetch(`/api/admin/listings?limit=${pageLimit}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to load listings");
  }
  const { listings } = await res.json();
  return listings as PropertyListing[];
}

// ─── Admin: get reported listings ────────────────────────────────────────────
// ✅ FIX: was calling d1Query() directly from client code — same issue as
// getAllListingsAdmin() above. Routed through a server API instead.
export async function getReportedListings(): Promise<PropertyListing[]> {
  try {
    const res = await fetch("/api/admin/reported-listings", { cache: "no-store" });
    if (!res.ok) return [];
    const { listings } = await res.json();
    return listings as PropertyListing[];
  } catch {
    return [];
  }
}
