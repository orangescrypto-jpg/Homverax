/**
 * app/api/conversations/route.ts
 * GET /api/conversations — the signed-in user's conversation list.
 *
 * ✅ FIX (this pass): the previous version built each conversation as
 * `{ id, participants: [], lastMessage, lastMessageAt, unreadCount: 0,
 * unreadFor: null }` — participants was ALWAYS an empty array, and
 * listingId/listingTitle/listingPrice/sellerId were never set at all.
 * The chat page derives the message recipient from
 * `conv.participants.find(p => p.id !== user.id)`, so with participants
 * always empty that lookup always returned undefined, `otherPId`/`receiverId`
 * fell back to `""`, and every send hit POST /messages' "Missing
 * receiverId or content" 400 — surfaced to the user as "Failed to send
 * message". It also broke the offer flow (handleSendOffer bails out when
 * `other` is undefined), the "isSeller" check, and the listing card /
 * counterpart name+avatar in the sidebar.
 *
 * Now: for each conversation we collect the distinct sender/receiver ids
 * across its messages, batch-fetch those users' name/avatar, and batch-
 * fetch the listing (title/price/agent_id as sellerId) from the first
 * listing_id we see. Unread count/unreadFor is computed from the
 * signed-in user's own unread rows in that conversation.
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
interface UserRow { id: string; name: string; avatar_url: string | null; }
interface ListingRow { id: string; title: string; price: number | null; agent_id: string; }

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<MsgRow>(
    "SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at DESC",
    [user.id, user.id]
  );

  interface ConvAcc {
    id: string; participantIds: Set<string>; listingId: string | null;
    lastMessage: string; lastMessageAt: string; unreadCount: number;
  }
  const convMap = new Map<string, ConvAcc>();
  for (const row of rows) {
    let acc = convMap.get(row.conversation_id);
    if (!acc) {
      acc = {
        id: row.conversation_id, participantIds: new Set(), listingId: row.listing_id ?? null,
        lastMessage: row.content, lastMessageAt: row.created_at, unreadCount: 0,
      };
      convMap.set(row.conversation_id, acc);
    }
    acc.participantIds.add(row.sender_id);
    acc.participantIds.add(row.receiver_id);
    if (!acc.listingId && row.listing_id) acc.listingId = row.listing_id;
    if (row.receiver_id === user.id && row.read === 0) acc.unreadCount += 1;
  }

  const convs = Array.from(convMap.values());

  // Batch-fetch all users involved across every conversation
  const allUserIds = Array.from(new Set(convs.flatMap((c) => Array.from(c.participantIds))));
  const userRows = allUserIds.length
    ? await d1Query<UserRow>(
        `SELECT id, name, avatar_url FROM users WHERE id IN (${allUserIds.map(() => "?").join(",")})`,
        allUserIds
      )
    : [];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  // Batch-fetch all listings referenced
  const allListingIds = Array.from(new Set(convs.map((c) => c.listingId).filter((v): v is string => !!v)));
  const listingRows = allListingIds.length
    ? await d1Query<ListingRow>(
        `SELECT id, title, price, agent_id FROM listings WHERE id IN (${allListingIds.map(() => "?").join(",")})`,
        allListingIds
      )
    : [];
  const listingMap = new Map(listingRows.map((l) => [l.id, l]));

  const conversations = convs.map((c) => {
    const listing = c.listingId ? listingMap.get(c.listingId) : undefined;
    return {
      id: c.id,
      participants: Array.from(c.participantIds).map((id) => {
        const u = userMap.get(id);
        return { id, name: u?.name ?? "User", avatarUrl: u?.avatar_url ?? undefined };
      }),
      listingId: c.listingId ?? undefined,
      listingTitle: listing?.title,
      listingPrice: listing?.price ?? undefined,
      sellerId: listing?.agent_id ?? null,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
      unreadFor: c.unreadCount > 0 ? user.id : null,
    };
  });

  return NextResponse.json({ conversations });
}
