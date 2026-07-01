/**
 * services/reviews.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */

import { d1Query, d1Exec, newId } from "@/lib/d1";

export interface Review {
  id: string;
  escrowId: string;
  listingId: string;
  listingTitle: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  revieweeId: string;
  revieweeName: string;
  rating: number;
  comment: string;
  type: "buyer_to_seller" | "seller_to_buyer";
  createdAt: string;
}

export interface UserRatingsSummary {
  userId: string;
  averageRating: number;
  totalReviews: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

interface ReviewRow {
  id: string;
  agent_id: string;
  reviewer_id: string;
  listing_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  // extended fields stored as JSON in comment prefix (workaround for minimal schema)
  escrow_id?: string;
  listing_title?: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
  reviewee_name?: string;
  review_type?: string;
}

export async function submitReview(params: {
  escrowId: string;
  listingId: string;
  listingTitle: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  revieweeId: string;
  revieweeName: string;
  rating: number;
  comment: string;
  type: "buyer_to_seller" | "seller_to_buyer";
}): Promise<void> {
  // Check duplicate
  const existing = await d1Query<{ id: string }>(
    "SELECT id FROM reviews WHERE agent_id = ? AND reviewer_id = ? AND listing_id = ?",
    [params.revieweeId, params.reviewerId, params.listingId || ""]
  );
  if (existing.length) throw new Error("You have already reviewed this transaction");

  const id = newId();
  const now = new Date().toISOString();
  // Store extra fields as JSON-prefixed comment
  const extData = JSON.stringify({
    escrowId: params.escrowId,
    listingTitle: params.listingTitle,
    reviewerName: params.reviewerName,
    reviewerAvatar: params.reviewerAvatar,
    revieweeName: params.revieweeName,
    type: params.type,
  });

  await d1Exec(
    "INSERT INTO reviews (id, agent_id, reviewer_id, listing_id, rating, comment, created_at) VALUES (?,?,?,?,?,?,?)",
    [id, params.revieweeId, params.reviewerId, params.listingId || null, params.rating, `${extData}||${params.comment}`, now]
  );

  await updateUserRating(params.revieweeId);
}

async function updateUserRating(userId: string): Promise<void> {
  const rows = await d1Query<{ rating: number }>(
    "SELECT rating FROM reviews WHERE agent_id = ?",
    [userId]
  );
  if (!rows.length) return;

  let total = 0;
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach((r) => {
    total += r.rating;
    dist[r.rating] = (dist[r.rating] ?? 0) + 1;
  });
  const avg = Math.round((total / rows.length) * 10) / 10;
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE users SET avg_rating = ?, review_count = ?, updated_at = ? WHERE id = ?",
    [avg, rows.length, now, userId]
  );
}

function parseReviewRow(row: ReviewRow): Review {
  let comment = row.comment ?? "";
  let ext: Record<string, string> = {};
  const sepIdx = comment.indexOf("||");
  if (sepIdx > -1) {
    try { ext = JSON.parse(comment.slice(0, sepIdx)); } catch {}
    comment = comment.slice(sepIdx + 2);
  }
  return {
    id: row.id,
    escrowId: ext.escrowId ?? "",
    listingId: row.listing_id ?? "",
    listingTitle: ext.listingTitle ?? "",
    reviewerId: row.reviewer_id,
    reviewerName: ext.reviewerName ?? "",
    reviewerAvatar: ext.reviewerAvatar,
    revieweeId: row.agent_id,
    revieweeName: ext.revieweeName ?? "",
    rating: row.rating,
    comment,
    type: (ext.type as Review["type"]) ?? "buyer_to_seller",
    createdAt: row.created_at,
  };
}

export async function getUserReviews(userId: string, pageLimit = 20): Promise<Review[]> {
  const rows = await d1Query<ReviewRow>(
    "SELECT * FROM reviews WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, pageLimit]
  );
  return rows.map(parseReviewRow);
}

export async function getListingReviews(listingId: string): Promise<Review[]> {
  const rows = await d1Query<ReviewRow>(
    "SELECT * FROM reviews WHERE listing_id = ? ORDER BY created_at DESC",
    [listingId]
  );
  return rows.map(parseReviewRow);
}

export async function getUserRatingSummary(userId: string): Promise<UserRatingsSummary> {
  const rows = await d1Query<{ avg_rating: number; review_count: number }>(
    "SELECT avg_rating, review_count FROM users WHERE id = ?",
    [userId]
  );
  const user = rows[0];
  return {
    userId,
    averageRating: user?.avg_rating ?? 0,
    totalReviews: user?.review_count ?? 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

export async function canReview(escrowId: string, reviewerId: string): Promise<boolean> {
  const rows = await d1Query<{ id: string }>(
    "SELECT id FROM reviews WHERE reviewer_id = ? LIMIT 1",
    [reviewerId]
  );
  return rows.length === 0;
}

export const getAgentReviews = getUserReviews;
export const hasReviewed = canReview;

export async function createReview(params: {
  agentId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  rating: number;
  comment: string;
  escrowId?: string;
  listingId?: string;
  listingTitle?: string;
  type?: "buyer_to_seller" | "seller_to_buyer";
}): Promise<Review> {
  const { agentId, ...rest } = params;
  await submitReview({
    escrowId: rest.escrowId ?? "direct",
    listingId: rest.listingId ?? "",
    listingTitle: rest.listingTitle ?? "",
    reviewerId: rest.reviewerId,
    reviewerName: rest.reviewerName,
    reviewerAvatar: rest.reviewerAvatar,
    revieweeId: agentId,
    revieweeName: "",
    rating: rest.rating,
    comment: rest.comment,
    type: rest.type ?? "buyer_to_seller",
  });
  return {
    id: "",
    escrowId: rest.escrowId ?? "direct",
    listingId: rest.listingId ?? "",
    listingTitle: rest.listingTitle ?? "",
    reviewerId: rest.reviewerId,
    reviewerName: rest.reviewerName,
    reviewerAvatar: rest.reviewerAvatar,
    revieweeId: agentId,
    revieweeName: "",
    rating: rest.rating,
    comment: rest.comment,
    type: rest.type ?? "buyer_to_seller",
    createdAt: new Date().toISOString(),
  };
}
