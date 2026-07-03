/**
 * services/savedSearches.ts — backed by Cloudflare D1.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";
import type { ListingFilters } from "@/types";

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: ListingFilters;
  alertsEnabled: boolean;
  createdAt: string;
}

interface SavedSearchRow {
  id: string;
  user_id: string;
  filters: string;
  name: string | null;
  created_at: string;
}

function rowToSaved(row: SavedSearchRow): SavedSearch {
  let filters: ListingFilters = {};
  try { filters = JSON.parse(row.filters); } catch {}
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name ?? "",
    filters,
    alertsEnabled: true,
    createdAt: row.created_at,
  };
}

// ✅ FIX: was calling d1Exec()/d1Query() directly from client dashboard
// code, silently blocked for non-staff users. Now routed through
// /api/saved-searches.
export async function saveSearch(userId: string, name: string, filters: ListingFilters): Promise<SavedSearch> {
  const res = await fetch("/api/saved-searches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, filters }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to save search");
  }
  const { search } = await res.json();
  return search as SavedSearch;
}

export async function getMySavedSearches(userId: string): Promise<SavedSearch[]> {
  const res = await fetch("/api/saved-searches", { cache: "no-store" });
  if (!res.ok) return [];
  const { searches } = await res.json();
  return (searches ?? []) as SavedSearch[];
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to delete saved search");
  }
}
