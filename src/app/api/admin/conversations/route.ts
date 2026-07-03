/**
 * app/api/admin/conversations/route.ts
 * GET /api/admin/conversations — ALL conversations on the platform.
 *
 * ✅ FIX: The admin dashboard had no Messages section at all. The only
 * existing route, /api/conversations, is scoped to `sender_id = ? OR
 * receiver_id = ?` for the signed-in user — by design, since it's meant
 * for regular users' own inbox. There was no equivalent for staff to see
 * every conversation on the platform, so an admin "Messages" list had
 * nothing to fetch from. This route mirrors the /api/admin/d1 auth
 * pattern (admin/moderator only) and aggregates every conversation from
 * the messages table, most-recent-first, with participant names resolved
 * from the users table for display.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";

interface MsgRow {
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  listing_id: string | null;
  content: string;
  read: number;
  created_at: string;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface ListingRow {
  id: string;
  title: string | null;
  price: number | null;
}

function extractText(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { _text?: string };
    if (typeof parsed._text === "string") return parsed._text;
  } catch {
    // plain text message
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (user.user_metadata?.role as string | undefined) ?? "";
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("q") ?? "").trim().toLowerCase();

  // Pull every message, most recent first, then collapse to one row per conversation.
  const rows = await d1Query<MsgRow>(
    "SELECT conversation_id, sender_id, receiver_id, listing_id, content, read, created_at FROM messages ORDER BY created_at DESC",
    []
  );

  type ConvAgg = {
    id: string;
    participantIds: Set<string>;
    lastMessage: string;
    lastMessageAt: string;
    listingId: string | null;
    messageCount: number;
    unreadCount: number;
  };

  const convMap = new Map<string, ConvAgg>();
  for (const row of rows) {
    let agg = convMap.get(row.conversation_id);
    if (!agg) {
      agg = {
        id: row.conversation_id,
        participantIds: new Set(),
        lastMessage: extractText(row.content),
        lastMessageAt: row.created_at,
        listingId: row.listing_id,
        messageCount: 0,
        unreadCount: 0,
      };
      convMap.set(row.conversation_id, agg);
    }
    agg.participantIds.add(row.sender_id);
    agg.participantIds.add(row.receiver_id);
    agg.messageCount += 1;
    if (row.read === 0) agg.unreadCount += 1;
    if (!agg.listingId && row.listing_id) agg.listingId = row.listing_id;
  }

  const allUserIds = Array.from(new Set(rows.flatMap((r) => [r.sender_id, r.receiver_id])));
  const allListingIds = Array.from(new Set(rows.map((r) => r.listing_id).filter(Boolean))) as string[];

  const usersById = new Map<string, UserRow>();
  if (allUserIds.length > 0) {
    const placeholders = allUserIds.map(() => "?").join(",");
    const userRows = await d1Query<UserRow>(
      `SELECT id, full_name, email, avatar_url FROM users WHERE id IN (${placeholders})`,
      allUserIds
    );
    for (const u of userRows) usersById.set(u.id, u);
  }

  const listingsById = new Map<string, ListingRow>();
  if (allListingIds.length > 0) {
    const placeholders = allListingIds.map(() => "?").join(",");
    const listingRows = await d1Query<ListingRow>(
      `SELECT id, title, price FROM listings WHERE id IN (${placeholders})`,
      allListingIds
    );
    for (const l of listingRows) listingsById.set(l.id, l);
  }

  let conversations = Array.from(convMap.values())
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
    .map((agg) => {
      const participants = Array.from(agg.participantIds).map((id) => {
        const u = usersById.get(id);
        return { id, name: u?.full_name ?? u?.email ?? "Unknown user", avatarUrl: u?.avatar_url ?? undefined };
      });
      const listing = agg.listingId ? listingsById.get(agg.listingId) : undefined;
      return {
        id: agg.id,
        participants,
        listingId: agg.listingId ?? undefined,
        listingTitle: listing?.title ?? undefined,
        listingPrice: listing?.price ?? undefined,
        lastMessage: agg.lastMessage,
        lastMessageAt: agg.lastMessageAt,
        messageCount: agg.messageCount,
        unreadCount: agg.unreadCount,
      };
    });

  if (search) {
    conversations = conversations.filter((c) =>
      c.participants.some((p) => p.name.toLowerCase().includes(search)) ||
      (c.listingTitle ?? "").toLowerCase().includes(search) ||
      c.lastMessage.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({ conversations });
}
