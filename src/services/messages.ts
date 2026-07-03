/**
 * services/messages.ts — backed by Cloudflare D1 + Supabase Realtime.
 *
 * D1 is the source of truth for all message data.
 * Supabase Postgres is a lightweight mirror used ONLY to trigger Realtime.
 * On every sendMessage(), we write to D1 first, then fire-and-forget a
 * mirror insert into Supabase so Realtime subscribers receive the event.
 */
import { newId } from "@/lib/d1";
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

// ✅ FIX: was calling d1Query() directly from client dashboard code,
// silently blocked for non-staff users. Now routed through
// /api/conversations. (Other functions in this file — sendMessage,
// markConversationRead, getConversationMessages, offer-in-chat — still
// need the same fix; not covered here.)
export async function getMyConversations(userId: string): Promise<Conversation[]> {
  const res = await fetch("/api/conversations", { cache: "no-store" });
  if (!res.ok) return [];
  const { conversations } = await res.json();
  return (conversations ?? []) as Conversation[];
}

// ✅ FIX: was calling d1Query() directly from the client to check for an
// existing conversation — silently blocked for non-staff users, so it
// always fell through to "create new" even when a thread already existed.
// Now checks via /api/conversations/find, a public route scoped to the
// signed-in user's own participant pairs.
export async function startConversation(
  participants: Conversation["participants"],
  listingId?: string,
  listingTitle?: string,
  listingPrice?: number,
  sellerId?: string,
): Promise<Conversation> {
  if (participants.length >= 2) {
    const [p1, p2] = participants;
    try {
      const res = await fetch(
        `/api/conversations/find?a=${encodeURIComponent(p1.id)}&b=${encodeURIComponent(p2.id)}&listingId=${encodeURIComponent(listingId ?? "")}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const { conversationId } = await res.json();
        if (conversationId) {
          return {
            id: conversationId, participants, listingId, listingTitle, listingPrice: listingPrice ?? 0,
            sellerId: sellerId ?? null, lastMessage: "", lastMessageAt: new Date().toISOString(),
            unreadCount: 0, unreadFor: null,
          };
        }
      }
    } catch {
      // fall through to creating a new conversation id below
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
 * ✅ FIX: used to call d1Exec() directly from the client — silently
 * blocked for non-staff users (the admin-gated D1 proxy), meaning no
 * regular user could send a chat message at all. Now goes through
 * POST /api/conversations/[id]/messages, which does the D1 write
 * server-side and fires a recipient notification.
 * Supabase mirror (for Realtime) still happens client-side, unchanged.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string,
  listingId?: string,
): Promise<Message> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiverId, content, listingId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to send message");
  }
  const { message } = await res.json();

  // Mirror to Supabase — fire-and-forget, failure is non-fatal
  void mirrorToSupabase({
    id: message.id,
    conversation_id: conversationId,
    sender_id: senderId,
    content,
    created_at: message.createdAt,
  });

  return message as Message;
}

// ✅ FIX: was calling d1Exec() directly from the client — silently blocked
// for non-staff users. Now routed through the same
// /api/conversations/[id]/messages route (PATCH).
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await fetch(`/api/conversations/${conversationId}/messages`, { method: "PATCH" });
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

// ✅ FIX: was calling d1Query() directly from the client — silently
// blocked for non-staff users, so opening a chat thread always returned
// an empty message list. Now routed through
// GET /api/conversations/[id]/messages.
export async function getConversationMessages(conversationId: string, pageLimit = 50): Promise<Message[]> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, { cache: "no-store" });
  if (!res.ok) return [];
  const { messages } = await res.json();
  return ((messages ?? []) as Message[]).slice(-pageLimit);
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
