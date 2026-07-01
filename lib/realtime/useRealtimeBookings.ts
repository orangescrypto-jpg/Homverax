"use client";
/**
 * lib/realtime/useRealtimeBookings.ts
 * Supabase Realtime — live booking status.
 */
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type BookingChangePayload = { id: string; status: string; updated_at: string };

export function useRealtimeBookings(
  userId: string | null,
  onChange: (payload: BookingChangePayload) => void
): void {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const buyerChannel = supabase
      .channel(`bookings:buyer:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `buyer_id=eq.${userId}` },
        (payload) => cbRef.current(payload.new as BookingChangePayload))
      .subscribe();

    const sellerChannel = supabase
      .channel(`bookings:seller:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `seller_id=eq.${userId}` },
        (payload) => cbRef.current(payload.new as BookingChangePayload))
      .subscribe();

    return () => {
      supabase.removeChannel(buyerChannel);
      supabase.removeChannel(sellerChannel);
    };
  }, [userId]);
}
