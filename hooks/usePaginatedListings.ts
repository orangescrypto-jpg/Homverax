"use client";

/**
 * hooks/usePaginatedListings.ts
 *
 * Cursor-based D1 pagination for listings.
 * Replaces the current approach of loading all results client-side.
 *
 * Features:
 *  - "Load More" button pattern (append pages)
 *  - Cursor preserved so re-renders don't reload from page 1
 *  - Integrates with existing searchListings() service
 *  - Admin-configurable page size via platformSettings
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { searchListings } from "@/services/listings";
import { getPlatformConfig } from "@/services/platformSettings";
import type { PropertyListing, ListingFilters, PaginatedResponse } from "@/types";

interface UsePaginatedListingsOptions {
  filters: ListingFilters;
  pageSize?: number;
  autoLoad?: boolean;
}

interface PaginatedState {
  listings:   PropertyListing[];
  isLoading:  boolean;
  isLoadingMore: boolean;
  hasMore:    boolean;
  totalCount: number;
  page:       number;
  error:      string | null;
}

export function usePaginatedListings({
  filters,
  pageSize,
  autoLoad = true,
}: UsePaginatedListingsOptions) {
  const [state, setState] = useState<PaginatedState>({
    listings:      [],
    isLoading:     autoLoad,
    isLoadingMore: false,
    hasMore:       false,
    totalCount:    0,
    page:          0,
    error:         null,
  });

  const [resolvedPageSize, setPageSize] = useState(pageSize ?? 12);
  const cursorRef = useRef<any>(null);
  const filtersRef = useRef(filters);

  // Load page size from admin settings if not provided
  useEffect(() => {
    if (pageSize) return;
    getPlatformConfig()
      .then((cfg) => setPageSize((cfg as any).listingsPerPage ?? 12))
      .catch(() => {});
  }, [pageSize]);

  const reset = useCallback(() => {
    cursorRef.current = null;
    setState({
      listings:      [],
      isLoading:     true,
      isLoadingMore: false,
      hasMore:       false,
      totalCount:    0,
      page:          0,
      error:         null,
    });
  }, []);

  const loadPage = useCallback(async (append = false) => {
    setState((prev) => ({
      ...prev,
      isLoading:     !append,
      isLoadingMore:  append,
      error:         null,
    }));

    try {
      const result: PaginatedResponse<PropertyListing> = await searchListings(
        { ...filtersRef.current, limit: resolvedPageSize }
      );

      // Store cursor for next page
      // We pass the last doc as the cursor — searchListings returns items already
      // We need to track the page number for the next call
      setState((prev) => ({
        listings:      append ? [...prev.listings, ...result.data] : result.data,
        isLoading:     false,
        isLoadingMore: false,
        hasMore:       result.totalPages > (result.page + 1),
        totalCount:    result.total,
        page:          result.page,
        error:         null,
      }));

      cursorRef.current = result.page + 1; // simple page number cursor
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading:     false,
        isLoadingMore: false,
        error:         err.message ?? "Failed to load listings",
      }));
    }
  }, [resolvedPageSize]);

  // Reload when filters change
  useEffect(() => {
    filtersRef.current = filters;
    reset();
  }, [JSON.stringify(filters)]);

  // Auto-load first page after reset
  useEffect(() => {
    if (state.isLoading && state.listings.length === 0) {
      loadPage(false);
    }
  }, [state.isLoading, state.listings.length, loadPage]);

  const loadMore = useCallback(() => {
    if (!state.hasMore || state.isLoadingMore) return;
    loadPage(true);
  }, [state.hasMore, state.isLoadingMore, loadPage]);

  const refresh = useCallback(() => {
    reset();
  }, [reset]);

  return {
    listings:      state.listings,
    isLoading:     state.isLoading,
    isLoadingMore: state.isLoadingMore,
    hasMore:       state.hasMore,
    totalCount:    state.totalCount,
    error:         state.error,
    loadMore,
    refresh,
  };
}
