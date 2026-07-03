/**
 * app/api/notifications/[id]/route.ts
 * PATCH /api/notifications/[id]  — mark a single notification read (owner only)
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec } from "@/lib/d1";

interface NotifRow {
  id: string;
  user_id: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<NotifRow>("SELECT id, user_id FROM notifications WHERE id = ?", [id]);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rows[0].user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await d1Exec("UPDATE notifications SET read = 1 WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
