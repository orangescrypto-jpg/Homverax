"use client";
/**
 * lib/realtime/useRealtimeEscrows.ts
 * Supabase Realtime — live escrow status updates.
 */
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type EscrowChangePayload = { id: string; status: string; updated_at: string };

export function useRealtimeEscrow(
  escrowId: string | null,
  onChange: (payload: EscrowChangePayload) => void
): void {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!escrowId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`escrow:${escrowId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "escrows", filter: `id=eq.${escrowId}` },
        (payload) => cbRef.current(payload.new as EscrowChangePayload))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [escrowId]);
}

export function useRealtimeUserEscrows(
  userId: string | null,
  onChange: (payload: EscrowChangePayload) => void
): void {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const buyerCh = supabase.channel(`escrows:buyer:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "escrows", filter: `buyer_id=eq.${userId}` },
        (payload) => cbRef.current(payload.new as EscrowChangePayload))
      .subscribe();

    const sellerCh = supabase.channel(`escrows:seller:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "escrows", filter: `seller_id=eq.${userId}` },
        (payload) => cbRef.current(payload.new as EscrowChangePayload))
      .subscribe();

    return () => {
      supabase.removeChannel(buyerCh);
      supabase.removeChannel(sellerCh);
    };
  }, [userId]);
}
