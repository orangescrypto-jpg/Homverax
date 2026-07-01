"use client";
/**
 * lib/realtime/useRealtimeListings.ts
 * Supabase Realtime — live listing status updates.
 */
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type ListingChangePayload = {
  id: string; status: string; boost_type: string;
  is_featured: number; is_flash_deal: number;
};

export function useRealtimeListing(
  listingId: string | null,
  onChange: (payload: ListingChangePayload) => void
): void {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!listingId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`listing:${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "listings",
          filter: `id=eq.${listingId}`,
        },
        (payload) => cbRef.current(payload.new as ListingChangePayload)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [listingId]);
}
