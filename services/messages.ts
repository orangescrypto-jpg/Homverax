/**
 * services/messages.ts — backed by Cloudflare D1 + Supabase Realtime.
 *
 * D1 is the source of truth for all message data.
 * Supabase Postgres is a lightweight mirror used ONLY to trigger Realtime.
 * On every sendMessage(), we write to D1 first, then fire-and-forget a
 * mirror insert into Supabase so Realtime subscribers receive the event.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, Message } from "@/types";
import { createOffer, acceptOffer, rejectOffer, counterOffer } from "@/services/offers";
import type { Offer } from "@/services/offers";

interface ConvRow {
  id: string; participants: string; listing_id: string | null; listing_title: string | null;
  last_message: string; last_message_at: string; unread_count: number;
  unread_for: string | null; listing_price: number | null; seller_id: string | null;
}

interface MsgRow {
  id: string; conversation_id: string; sender_id: string; receiver_id: string;
  listing_id: string | null; content: string; read: number; created_at: string;
}

function rowToConversation(row: ConvRow): Conversation {
  let participants: Conversation["participants"] = [];
  try { participants = JSON.parse(row.participants); } catch {}
  return {
    id: row.id, participants, listingId: row.listing_id ?? undefined,
    listingTitle: row.listing_title ?? undefined, listingPrice: row.listing_price ?? undefined,
    sellerId: row.seller_id, lastMessage: row.last_message,
    lastMessageAt: row.last_message_at, unreadCount: row.unread_count, unreadFor: row.unread_for,
  };
}

function rowToMessage(row: MsgRow): Message {
  let content = row.content;
  let type: Message["type"] = "text";
  let offerData: Message["offerData"] = null;
  try {
    const parsed = JSON.parse(row.content) as { _type?: string; _offerData?: Message["offerData"]; _text?: string };
    if (parsed._type) { type = parsed._type as Message["type"]; offerData = parsed._offerData ?? null; content = parsed._text ?? ""; }
  } catch {}
  return { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, content, readAt: row.read === 1 ? row.created_at : undefined, createdAt: row.created_at, type, offerData };
}

// ─── Mirror a message row to Supabase to trigger Realtime ────────────────────
// Fire-and-forget — never throws, never blocks the main send flow.

async function mirrorToSupabase(params: {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("messages").insert(params);
    if (error) {
      console.warn("[messages] Supabase mirror insert error (realtime may be delayed):", error.message);
    }
  } catch (err) {
    console.warn("[messages] Supabase mirror write failed (realtime may be delayed):", err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getMyConversations(userId: string): Promise<Conversation[]> {
  const rows = await d1Query<MsgRow>(
    "SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? GROUP BY conversation_id ORDER BY created_at DESC",
    [userId, userId]
  );
  const convMap = new Map<string, Conversation>();
  for (const row of rows) {
    const convId = row.conversation_id;
    if (!convMap.has(convId)) {
      convMap.set(convId, {
        id: convId, participants: [], lastMessage: row.content, lastMessageAt: row.created_at,
        unreadCount: 0, unreadFor: null,
      });
    }
  }
  return Array.from(convMap.values());
}

export async function startConversation(
  participants: Conversation["participants"],
  listingId?: string,
  listingTitle?: string,
  listingPrice?: number,
  sellerId?: string,
): Promise<Conversation> {
  if (participants.length >= 2) {
    const [p1, p2] = participants;
    const rows = await d1Query<MsgRow>(
      "SELECT conversation_id FROM messages WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND listing_id IS ? LIMIT 1",
      [p1.id, p2.id, p2.id, p1.id, listingId ?? null]
    );
    if (rows.length) {
      const convId = rows[0].conversation_id;
      return {
        id: convId, participants, listingId, listingTitle, listingPrice: listingPrice ?? 0,
        sellerId: sellerId ?? null, lastMessage: "", lastMessageAt: new Date().toISOString(),
        unreadCount: 0, unreadFor: null,
      };
    }
  }

  const convId = newId();
  return {
    id: convId, participants, listingId, listingTitle, listingPrice: listingPrice ?? 0,
    sellerId: sellerId ?? null, lastMessage: "", lastMessageAt: new Date().toISOString(),
    unreadCount: 0, unreadFor: null,
  };
}

/**
 * Send a message.
 * 1. Writes to D1 (source of truth, full data).
 * 2. Mirrors a lightweight row to Supabase Postgres (fire-and-forget).
 *    This triggers Supabase Realtime so the recipient sees the message
 *    instantly without a page refresh.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string,
  listingId?: string,
): Promise<Message> {
  const id = newId();
  const now = new Date().toISOString();

  // 1. Write to D1 — always awaited, never skipped
  await d1Exec(
    "INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, content, read, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [id, conversationId, senderId, receiverId, listingId ?? null, content, 0, now]
  );

  // 2. Mirror to Supabase — fire-and-forget, failure is non-fatal
  void mirrorToSupabase({ id, conversation_id: conversationId, sender_id: senderId, content, created_at: now });

  return { id, conversationId, senderId, content, createdAt: now, type: "text", offerData: null };
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await d1Exec("UPDATE messages SET read = 1 WHERE conversation_id = ? AND receiver_id = ?", [conversationId, userId]);
}

export function subscribeToMessages(conversationId: string, callback: (msg: Message) => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload: { new: MsgRow }) => {
        const row = payload.new;
        callback(rowToMessage(row));
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeToConversations(userId: string, callback: (convs: Conversation[]) => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`conversations:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
      async () => {
        const convs = await getMyConversations(userId);
        callback(convs);
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function getConversationMessages(conversationId: string, pageLimit = 50): Promise<Message[]> {
  const rows = await d1Query<MsgRow>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
    [conversationId, pageLimit]
  );
  return rows.map(rowToMessage);
}

/**
 * Send an offer message.
 * Creates the offer in D1, then sends a message containing the offer data.
 * The sendMessage() call handles the Supabase mirror automatically.
 */
export async function sendOfferMessage(params: {
  conversationId: string; senderId: string; receiverId: string;
  listingId: string; listingTitle: string; proposedPrice: number; originalPrice: number;
  buyerId: string; buyerName: string; sellerId: string; sellerName: string; note?: string;
}): Promise<{ message: Message; offer: Offer }> {
  const offer = await createOffer({
    listingId: params.listingId, listingTitle: params.listingTitle,
    conversationId: params.conversationId, buyerId: params.buyerId, buyerName: params.buyerName,
    sellerId: params.sellerId, sellerName: params.sellerName,
    proposedPrice: params.proposedPrice, originalPrice: params.originalPrice, note: params.note,
  });
  const content = JSON.stringify({
    _type: "offer",
    _offerData: {
      offerId: offer.id, proposedPrice: offer.proposedPrice, originalPrice: offer.originalPrice,
      status: "pending", note: offer.note, sellerId: offer.sellerId, listingId: offer.listingId,
    },
    _text: `Offer: ₦${offer.proposedPrice.toLocaleString()}`,
  });

  // sendMessage handles both D1 write and Supabase mirror
  const msg = await sendMessage(params.conversationId, params.senderId, params.receiverId, content, params.listingId);
  return { message: { ...msg, type: "offer" }, offer };
}

export async function acceptOfferFromChat(offerId: string): Promise<void> {
  await acceptOffer(offerId);
}

export async function rejectOfferFromChat(offerId: string): Promise<void> {
  await rejectOffer(offerId);
}

export async function counterOfferFromChat(
  offerId: string, counterPrice: number, counterNote?: string,
): Promise<void> {
  await counterOffer(offerId, counterPrice, counterNote);
}
