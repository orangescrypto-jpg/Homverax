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
export async function getListingById(id: string): Promise<PropertyListing | null> {
  const rows = await d1Query<ListingRow>(`SELECT ${LISTING_SELECT} WHERE l.id = ?`, [id]);
  if (!rows.length) return null;
  // Increment views async
  const now = new Date().toISOString();
  d1Exec("UPDATE listings SET views = views + 1, updated_at = ? WHERE id = ?", [now, id]).catch(() => {});
  return rowToListing(rows[0]);
}

// ─── Search / filter listings ─────────────────────────────────────────────────
export async function searchListings(
  filters: ListingFilters
): Promise<PaginatedResponse<PropertyListing>> {
  const pageLimit = filters.limit ?? 12;
  const conditions: string[] = ["l.status = 'active'"];
  const params: unknown[] = [];

  if (filters.category)     { conditions.push("l.category = ?");      params.push(filters.category); }
  if (filters.state)        { conditions.push("l.state = ?");          params.push(filters.state); }
  if (filters.propertyType) { conditions.push("l.property_type = ?");  params.push(filters.propertyType); }
  if (filters.listingType)  { conditions.push("l.listing_type = ?");   params.push(filters.listingType); }
  if (filters.verifiedOnly) { conditions.push("l.is_property_verified = 1"); }
  if (filters.furnished !== undefined) { conditions.push("l.furnished = ?"); params.push(filters.furnished ? 1 : 0); }
  if (filters.minPrice !== undefined)  { conditions.push("l.price >= ?"); params.push(filters.minPrice); }
  if (filters.maxPrice !== undefined)  { conditions.push("l.price <= ?"); params.push(filters.maxPrice); }
  if (filters.bedrooms !== undefined)  { conditions.push("l.bedrooms >= ?"); params.push(filters.bedrooms); }
  if (filters.query) {
    const q = `%${filters.query}%`;
    conditions.push("(l.title LIKE ? OR l.description LIKE ? OR l.address LIKE ? OR l.state LIKE ?)");
    params.push(q, q, q, q);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  // Fetch a 3× pool for re-ranking by boost
  const fetchLimit = (pageLimit + 1) * 3;
  params.push(fetchLimit);

  const rows = await d1Query<ListingRow>(
    `SELECT ${LISTING_SELECT} ${where} ORDER BY l.created_at DESC LIMIT ?`,
    params
  );

  let items = rows.map(rowToListing);

  // Re-rank by boost score (same logic as Firebase version)
  const getScore = (l: PropertyListing & { agentRankBoost?: number }): number => {
    let score = 0;
    if (l.boostType === "top_placement") score += 1000;
    if (l.boostType === "featured")      score += 500;
    if (l.boostType === "urgent")        score += 50;
    score += (l.agentRankBoost ?? 0) * 100;
    return score;
  };

  items.sort((a, b) => getScore(b as PropertyListing & { agentRankBoost?: number }) - getScore(a as PropertyListing & { agentRankBoost?: number }));

  const hasMore = items.length > pageLimit;
  const page = filters.page ?? 0;

  return {
    data: items.slice(0, pageLimit),
    total: items.length,
    page,
    limit: pageLimit,
    totalPages: hasMore ? page + 2 : page + 1,
  };
}

// ─── Get listings by agent ────────────────────────────────────────────────────
export async function getMyListings(agentId: string): Promise<PropertyListing[]> {
  const rows = await d1Query<ListingRow>(
    `SELECT ${LISTING_SELECT} WHERE l.agent_id = ? ORDER BY l.created_at DESC`,
    [agentId]
  );
  return rows.map(rowToListing);
}

// ─── Update listing ───────────────────────────────────────────────────────────
export async function updateListing(
  id: string,
  updates: Partial<PropertyListing>
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (updates.title !== undefined)              { fields.push("title = ?");               values.push(updates.title); }
  if (updates.description !== undefined)        { fields.push("description = ?");         values.push(updates.description); }
  if (updates.category !== undefined)           { fields.push("category = ?");            values.push(updates.category); }
  if (updates.propertyType !== undefined)       { fields.push("property_type = ?");       values.push(updates.propertyType); }
  if (updates.listingType !== undefined)        { fields.push("listing_type = ?");        values.push(updates.listingType); }
  if (updates.price !== undefined)              { fields.push("price = ?");               values.push(updates.price); }
  if (updates.priceUnit !== undefined)          { fields.push("price_unit = ?");          values.push(updates.priceUnit); }
  if (updates.location?.state !== undefined)    { fields.push("state = ?");               values.push(updates.location.state); }
  if (updates.location?.lga !== undefined)      { fields.push("lga = ?");                 values.push(updates.location.lga); }
  if (updates.location?.address !== undefined)  { fields.push("address = ?");             values.push(updates.location.address); }
  if (updates.location?.latitude !== undefined) { fields.push("latitude = ?");            values.push(updates.location.latitude); }
  if (updates.location?.longitude !== undefined){ fields.push("longitude = ?");           values.push(updates.location.longitude); }
  if (updates.bedrooms !== undefined)           { fields.push("bedrooms = ?");            values.push(updates.bedrooms); }
  if (updates.bathrooms !== undefined)          { fields.push("bathrooms = ?");           values.push(updates.bathrooms); }
  if (updates.toilets !== undefined)            { fields.push("toilets = ?");             values.push(updates.toilets); }
  if (updates.parkingSpaces !== undefined)      { fields.push("parking_spaces = ?");      values.push(updates.parkingSpaces); }
  if (updates.areaSqM !== undefined)            { fields.push("area_sq_m = ?");           values.push(updates.areaSqM); }
  if (updates.furnished !== undefined)          { fields.push("furnished = ?");           values.push(updates.furnished ? 1 : 0); }
  if (updates.images !== undefined)             { fields.push("images = ?");              values.push(JSON.stringify(updates.images)); }
  if (updates.videoUrl !== undefined)           { fields.push("video_url = ?");           values.push(updates.videoUrl); }
  if (updates.boostType !== undefined)          { fields.push("boost_type = ?");          values.push(updates.boostType); }
  if (updates.boostExpiresAt !== undefined)     { fields.push("boost_expires_at = ?");    values.push(updates.boostExpiresAt); }
  if (updates.isPropertyVerified !== undefined) { fields.push("is_property_verified = ?");values.push(updates.isPropertyVerified ? 1 : 0); }
  if (updates.isFeatured !== undefined)         { fields.push("is_featured = ?");         values.push(updates.isFeatured ? 1 : 0); }
  if (updates.status !== undefined)             { fields.push("status = ?");              values.push(updates.status); }

  values.push(id);
  await d1Exec(`UPDATE listings SET ${fields.join(", ")} WHERE id = ?`, values);
}

// ─── Delete listing ───────────────────────────────────────────────────────────
export async function deleteListing(id: string): Promise<void> {
  await d1Exec("DELETE FROM listings WHERE id = ?", [id]);
}

// ─── Save / unsave listing ────────────────────────────────────────────────────
export async function saveListing(userId: string, listingId: string): Promise<void> {
  const id = `${userId}_${listingId}`;
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT OR IGNORE INTO saved_listings (id, user_id, listing_id, created_at) VALUES (?, ?, ?, ?)",
    [id, userId, listingId, now]
  );
  await d1Exec("UPDATE listings SET saves = saves + 1 WHERE id = ?", [listingId]);
}

export async function unsaveListing(userId: string, listingId: string): Promise<void> {
  const id = `${userId}_${listingId}`;
  await d1Exec("DELETE FROM saved_listings WHERE id = ?", [id]);
  await d1Exec("UPDATE listings SET saves = MAX(0, saves - 1) WHERE id = ?", [listingId]);
}

export async function isListingSaved(userId: string, listingId: string): Promise<boolean> {
  const rows = await d1Query<{ id: string }>(
    "SELECT id FROM saved_listings WHERE id = ?",
    [`${userId}_${listingId}`]
  );
  return rows.length > 0;
}

export async function getSavedListings(userId: string): Promise<PropertyListing[]> {
  const rows = await d1Query<ListingRow>(
    `SELECT ${LISTING_SELECT}
     INNER JOIN saved_listings sl ON sl.listing_id = l.id
     WHERE sl.user_id = ?
     ORDER BY sl.created_at DESC`,
    [userId]
  );
  return rows.map(rowToListing);
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
