/**
 * app/api/auth/me/route.ts
 * GET /api/auth/me — returns the current user's D1 profile.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await d1Query<Record<string, unknown>>(
    "SELECT * FROM users WHERE id = ?",
    [user.id]
  );

  if (!rows.length) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  return NextResponse.json({ user: rows[0] });
}
