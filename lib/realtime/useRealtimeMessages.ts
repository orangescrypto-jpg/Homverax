"use client";
/**
 * lib/realtime/useRealtimeMessages.ts
 * Supabase Realtime subscription for live chat messages.
 * Replaces Firestore onSnapshot for the messages collection.
 */
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types";

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: number;
  created_at: string;
}

function rowToMessage(row: MessageRow): Message {
  let content = row.content;
  let type: Message["type"] = "text";
  let offerData: Message["offerData"] = null;
  try {
    const parsed = JSON.parse(row.content) as { _type?: string; _offerData?: Message["offerData"]; _text?: string };
    if (parsed._type) { type = parsed._type as Message["type"]; offerData = parsed._offerData ?? null; content = parsed._text ?? ""; }
  } catch {}
  return { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, content, createdAt: row.created_at, type, offerData };
}

export function useRealtimeMessages(
  conversationId: string | null,
  onNewMessage: (msg: Message) => void
): void {
  const cbRef = useRef(onNewMessage);
  cbRef.current = onNewMessage;

  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`messages:conv:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = rowToMessage(payload.new as MessageRow);
          cbRef.current(msg);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);
}
