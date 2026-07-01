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

export async function saveSearch(userId: string, name: string, filters: ListingFilters): Promise<SavedSearch> {
  const id = newId();
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO saved_searches (id, user_id, filters, name, created_at) VALUES (?,?,?,?,?)",
    [id, userId, JSON.stringify(filters), name, now]
  );
  const rows = await d1Query<SavedSearchRow>("SELECT * FROM saved_searches WHERE id = ?", [id]);
  return rowToSaved(rows[0]);
}

export async function getMySavedSearches(userId: string): Promise<SavedSearch[]> {
  const rows = await d1Query<SavedSearchRow>(
    "SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  return rows.map(rowToSaved);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await d1Exec("DELETE FROM saved_searches WHERE id = ?", [id]);
}
