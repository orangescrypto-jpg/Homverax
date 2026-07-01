/**
 * app/api/admin/set-role/route.ts
 * POST /api/admin/set-role
 *
 * One-off / manual utility to promote a user to admin (or any role) via
 * the Supabase Admin API — this is the only reliable way to update
 * user_metadata so it actually reflects on new sessions. A direct SQL
 * UPDATE against auth.users.raw_user_meta_data does not always propagate
 * the same way admin.updateUserById() does.
 *
 * Protected by ADMIN_SETUP_SECRET — set this in your Vercel env vars,
 * call once, then feel free to remove this route or rotate the secret.
 *
 * Usage:
 *   curl -X POST https://homverax.vercel.app/api/admin/set-role \
 *     -H "Content-Type: application/json" \
 *     -H "x-admin-secret: <ADMIN_SETUP_SECRET>" \
 *     -d '{"email": "alasiriemmanuel@gmail.com", "role": "admin"}'
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { d1Exec } from "@/lib/d1";

const ALLOWED_ROLES = ["admin", "moderator", "tenant", "agent", "landlord", "service_provider"] as const;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string };
  const { email, role } = body;

  if (!email || !role || !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: "email and a valid role are required" }, { status: 400 });
  }

  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the Supabase auth user by email.
  const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json({ error: `Failed to list users: ${listError.message}` }, { status: 500 });
  }
  const authUser = userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!authUser) {
    return NextResponse.json({ error: "No Supabase auth user found with that email" }, { status: 404 });
  }

  // 1. Update via Admin API — the reliable way to change user_metadata so
  //    it actually shows up on freshly issued sessions/JWTs.
  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    user_metadata: { ...authUser.user_metadata, role, role_selected: true },
  });
  if (metaError) {
    return NextResponse.json({ error: `Failed to update Supabase metadata: ${metaError.message}` }, { status: 500 });
  }

  // 2. Keep D1 in sync as the source of truth.
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE users SET role = ?, role_selected = 1, updated_at = ? WHERE id = ?",
    [role, now, authUser.id]
  );

  return NextResponse.json({ success: true, userId: authUser.id, email: authUser.email, role });
}
