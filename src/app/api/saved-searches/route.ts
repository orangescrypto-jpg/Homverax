/**
 * app/api/saved-searches/route.ts
 * GET  /api/saved-searches — the signed-in user's saved searches.
 * POST /api/saved-searches — save a new search.
 *
 * ✅ FIX: getMySavedSearches()/saveSearch() called d1Query()/d1Exec()
 * directly from client dashboard code, silently blocked for non-staff
 * users after the admin-gated D1 proxy was introduced.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec, newId } from "@/lib/d1";

interface SavedSearchRow { id: string; user_id: string; filters: string; name: string | null; created_at: string; }

function rowToSaved(row: SavedSearchRow) {
  let filters = {};
  try { filters = JSON.parse(row.filters); } catch {}
  return { id: row.id, userId: row.user_id, name: row.name ?? "", filters, alertsEnabled: true, createdAt: row.created_at };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<SavedSearchRow>(
    "SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC", [user.id]
  );
  return NextResponse.json({ searches: rows.map(rowToSaved) });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const id = newId();
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO saved_searches (id, user_id, filters, name, created_at) VALUES (?,?,?,?,?)",
    [id, user.id, JSON.stringify(body.filters ?? {}), body.name, now]
  );
  const rows = await d1Query<SavedSearchRow>("SELECT * FROM saved_searches WHERE id = ?", [id]);
  return NextResponse.json({ search: rowToSaved(rows[0]) });
}
