/**
 * app/api/conversations/find/route.ts
 * GET /api/conversations/find?a=<userId>&b=<userId>&listingId=<id|"">
 *
 * Looks up an existing conversation between two participants for a given
 * listing (or no listing). Used by startConversation() in
 * services/messages.ts to reuse a thread instead of always creating a new
 * one — replicates the exact matching logic that function used to run via
 * a direct d1Query() call (blocked for regular users by the admin-gated
 * D1 proxy).
 *
 * Scoped to the signed-in user: only usable when the caller is one of the
 * two participants being looked up, so it can't be used to snoop on
 * unrelated users' conversations.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";

interface MsgRow {
  conversation_id: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  const listingIdParam = searchParams.get("listingId");
  const listingId = listingIdParam && listingIdParam.length ? listingIdParam : null;

  if (!a || !b) {
    return NextResponse.json({ error: "Missing a/b participant ids" }, { status: 400 });
  }
  if (user.id !== a && user.id !== b) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await d1Query<MsgRow>(
    `SELECT conversation_id FROM messages
     WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
     AND listing_id IS ? LIMIT 1`,
    [a, b, b, a, listingId]
  );

  return NextResponse.json({ conversationId: rows.length ? rows[0].conversation_id : null });
}
