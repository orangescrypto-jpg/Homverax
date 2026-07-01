/**
 * services/listings.ts
 *
 * All listing CRUD and queries — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */

import { d1Query, d1Exec, newId } from "@/lib/d1";
import { uploadListingImages as storageUploadListingImages } from "@/services/storage";
import type { PropertyListing, ListingFilters, PaginatedResponse } from "@/types";

// ─── Row from D1 listings table ───────────────────────────────────────────────
interface ListingRow {
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

function rowToListing(row: ListingRow): PropertyListing {
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
    boostType: (row.boost_type as PropertyListing["boostType"]) ?? "none",
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

const LISTING_SELECT = `
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
export async function createListing(
  data: Omit<PropertyListing, "id" | "createdAt" | "updatedAt" | "viewsCount" | "inquiriesCount" | "savedCount">,
  imageFiles: File[]
): Promise<PropertyListing> {
  const id = newId();
  const now = new Date().toISOString();

  // Fetch agent rank boost from their subscription plan
  const agentRows = await d1Query<{ subscription_plan: string }>(
    "SELECT subscription_plan FROM users WHERE id = ?",
    [data.agentId]
  );
  const plan = agentRows[0]?.subscription_plan ?? "free";
  const RANK_BOOSTS: Record<string, number> = { free: 0, basic: 0, pro: 2, premium: 5 };
  const agentRankBoost = RANK_BOOSTS[plan] ?? 0;

  let images = data.images ?? [];
  if (imageFiles.length > 0) {
    images = await storageUploadListingImages(id, imageFiles);
  }

  await d1Exec(
    `INSERT INTO listings
      (id, agent_id, title, description, category, property_type, listing_type,
       price, price_unit, state, lga, address, latitude, longitude,
       bedrooms, bathrooms, toilets, parking_spaces, area_sq_m, furnished,
       images, video_url, virtual_tour_url, boost_type, is_property_verified,
       is_featured, agent_rank_boost, status, views, saves, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      data.agentId,
      data.title,
      data.description ?? null,
      data.category ?? null,
      data.propertyType ?? null,
      data.listingType ?? null,
      data.price ?? null,
      data.priceUnit ?? null,
      data.location?.state ?? null,
      data.location?.lga ?? null,
      data.location?.address ?? null,
      data.location?.latitude ?? null,
      data.location?.longitude ?? null,
      data.bedrooms ?? null,
      data.bathrooms ?? null,
      data.toilets ?? null,
      data.parkingSpaces ?? null,
      data.areaSqM ?? null,
      data.furnished ? 1 : 0,
      JSON.stringify(images),
      data.videoUrl ?? null,
      data.virtualTourUrl ?? null,
      data.boostType ?? "none",
      data.isPropertyVerified ? 1 : 0,
      data.isFeatured ? 1 : 0,
      agentRankBoost,
      "active",
      0,
      0,
      now,
      now,
    ]
  );

  const rows = await d1Query<ListingRow>(`SELECT ${LISTING_SELECT} WHERE l.id = ?`, [id]);
  return rowToListing(rows[0]);
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
  boostType: PropertyListing["boostType"]
): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE listings SET boost_type = ?, updated_at = ? WHERE id = ?",
    [boostType, now, listingId]
  );
}

// ─── Admin: get all listings ──────────────────────────────────────────────────
export async function getAllListingsAdmin(pageLimit = 200): Promise<PropertyListing[]> {
  const rows = await d1Query<ListingRow>(
    `SELECT ${LISTING_SELECT} ORDER BY l.created_at DESC LIMIT ?`,
    [pageLimit]
  );
  return rows.map(rowToListing);
}

// ─── Admin: get reported listings ────────────────────────────────────────────
export async function getReportedListings(): Promise<PropertyListing[]> {
  try {
    const rows = await d1Query<ListingRow>(
      `SELECT ${LISTING_SELECT} WHERE l.status = 'reported' ORDER BY l.updated_at DESC`,
      []
    );
    return rows.map(rowToListing);
  } catch {
    return [];
  }
}
