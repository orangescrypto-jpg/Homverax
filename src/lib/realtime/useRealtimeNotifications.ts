"use client";
/**
 * lib/realtime/useRealtimeNotifications.ts
 * Supabase Realtime for the notification bell.
 */
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface NotifRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string | null;
  read: number;
  link: string | null;
  created_at: string;
}

export interface RealtimeNotification {
  id: string; userId: string; title: string; body: string;
  type: string; isRead: boolean; actionUrl?: string; createdAt: string;
}

export function useRealtimeNotifications(
  userId: string | null,
  onNewNotification: (notif: RealtimeNotification) => void
): void {
  const cbRef = useRef(onNewNotification);
  cbRef.current = onNewNotification;

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotifRow;
          cbRef.current({
            id: row.id, userId: row.user_id, title: row.title, body: row.body,
            type: row.type ?? "system", isRead: false,
            actionUrl: row.link ?? undefined, createdAt: row.created_at,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);
}
