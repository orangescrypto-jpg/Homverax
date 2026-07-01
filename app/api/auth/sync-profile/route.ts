/**
 * app/api/auth/sync-profile/route.ts
 * POST /api/auth/sync-profile
 *
 * Creates the D1 `users` row for an auth user that was already created
 * client-side (via supabase.auth.signUp / OAuth). This MUST run server-side
 * because d1Exec() needs CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN,
 * which are server-only secrets and are never available in the browser.
 *
 * This is intentionally permissive about the auth user already existing —
 * it does not re-verify credentials, it just upserts a profile row for a
 * given Supabase user id. INSERT OR IGNORE makes this safe to call multiple
 * times (e.g. retried after a network blip) without creating duplicates.
 */
import { NextResponse, type NextRequest } from "next/server";
import { d1Exec } from "@/lib/d1";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      id?: string;
      email?: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    };
    const { id, email, name, firstName, lastName, avatarUrl } = body;

    if (!id || !email || !name) {
      return NextResponse.json({ error: "id, email and name are required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    await d1Exec(
      `INSERT OR IGNORE INTO users
         (id, email, name, first_name, last_name, avatar_url, role, role_selected,
          is_verified, verification_status, subscription_plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'tenant', 0, 0, 'none', 'free', ?, ?)`,
      [id, email, name.trim(), firstName ?? "", lastName ?? "", avatarUrl ?? null, now, now]
    );

    return NextResponse.json({ id, email, name: name.trim() }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[sync-profile] D1 insert failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

