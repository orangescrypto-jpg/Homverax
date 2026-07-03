/**
 * app/api/reviews/route.ts
 * GET /api/reviews?userId=X — reviews + rating summary for a given agent.
 * Public/unauthenticated — reviews about an agent are meant to be visible
 * to anyone evaluating them, same as the rest of a public listing/profile.
 *
 * ✅ FIX: getUserReviews()/getUserRatingSummary() in services/reviews.ts
 * called d1Query() directly from client code, silently blocked for
 * non-staff users (this specific instance only had a dashboard caller so
 * far, but is public here for future agent-profile-page use too).
 */
import { NextResponse, type NextRequest } from "next/server";
import { d1Query } from "@/lib/d1";

interface ReviewRow {
  id: string; escrow_id: string; agent_id: string; reviewer_id: string;
  reviewer_name: string | null; rating: number; comment: string | null; created_at: string;
}

function parseReviewRow(row: ReviewRow) {
  return {
    id: row.id, escrowId: row.escrow_id, agentId: row.agent_id, reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name ?? "Anonymous", rating: row.rating,
    comment: row.comment ?? "", createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const reviewRows = await d1Query<ReviewRow>(
    "SELECT * FROM reviews WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20", [userId]
  );
  const reviews = reviewRows.map(parseReviewRow);

  const userRows = await d1Query<{ avg_rating: number; review_count: number }>(
    "SELECT avg_rating, review_count FROM users WHERE id = ?", [userId]
  );
  const summary = {
    userId,
    averageRating: userRows[0]?.avg_rating ?? 0,
    totalReviews: userRows[0]?.review_count ?? 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  return NextResponse.json({ reviews, summary });
}
