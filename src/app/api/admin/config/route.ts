/**
 * app/api/admin/config/route.ts
 * POST /api/admin/config — atomically read-merge-write the platform config.
 *
 * ✅ FIX: the old client-side savePlatformConfig() read "current settings"
 * via getPlatformConfig(), which silently falls back to DEFAULT_CONFIG on
 * ANY failure (network hiccup, exhausted retry count, etc). If that
 * happened at the exact moment an admin saved even one small toggle, the
 * save would merge that one change on top of a blank default config —
 * silently wiping out every other previously-customized setting. This
 * looked like "settings reset after some time" because it only happened
 * on the unlucky save where the read failed, not every save.
 *
 * This route does the read + merge + write as one atomic, authenticated,
 * server-side operation using d1Query() directly (no client fetch, no
 * silent default fallback) — if the read fails here, the whole request
 * fails loudly instead of quietly discarding existing settings.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec } from "@/lib/d1";
import { loadPlatformConfigFromDb } from "@/services/platformSettings";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (user.user_metadata?.role as string | undefined) ?? "";
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.config) {
    return NextResponse.json({ error: "Missing config" }, { status: 400 });
  }

  // Real current settings, read directly and reliably — no client fetch,
  // no silent fallback to defaults.
  const current = await loadPlatformConfigFromDb();
  const merged = { ...current, ...body.config };
  const now = new Date().toISOString();
  const adminName = (user.user_metadata?.name as string) ?? user.email ?? "Unknown";

  await d1Exec(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ('config', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify({ ...merged, _updatedBy: `${adminName} (${user.id})` }), now]
  );

  return NextResponse.json({ config: merged });
}
