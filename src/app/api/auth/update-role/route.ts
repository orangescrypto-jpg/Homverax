/**
 * app/api/auth/update-role/route.ts
 * POST /api/auth/update-role
 *
 * Updates the caller's role in D1 (source of truth) AND mirrors it into
 * Supabase user_metadata so the role is available directly on the session
 * JWT — middleware can then read it with zero extra network calls instead
 * of querying D1 on every /admin request.
 *
 * Only the authenticated user's own row can be updated here. Promoting
 * another user to admin/moderator should go through a separate,
 * admin-only endpoint — not this one.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { d1Exec } from "@/lib/d1";

const SELECTABLE_ROLES = ["tenant", "agent", "landlord", "service_provider"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { role?: string };
    const { role } = body;

    if (!role || !SELECTABLE_ROLES.includes(role as (typeof SELECTABLE_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Identify the caller from their session cookie.
    const supabaseServer = await createServerSupabase();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const now = new Date().toISOString();

    // 1. D1 stays the source of truth.
    await d1Exec(
      "UPDATE users SET role = ?, role_selected = 1, updated_at = ? WHERE id = ?",
      [role, now, user.id]
    );

    // 2. Mirror the role into Supabase user_metadata so it rides along on
    //    the JWT for fast, no-network-call reads in middleware.
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, role, role_selected: true },
    });
    if (metaError) {
      // D1 write already succeeded — log but don't fail the request, since
      // the role itself was set correctly. Metadata will resync on next
      // explicit role change or re-login.
      console.error("[update-role] Failed to sync role into Supabase metadata:", metaError.message);
    }

    return NextResponse.json({ success: true, role });
  } catch (err) {
    console.error("[update-role] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
