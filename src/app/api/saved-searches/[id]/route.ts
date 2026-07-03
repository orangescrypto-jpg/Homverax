/**
 * app/api/saved-searches/[id]/route.ts
 * DELETE /api/saved-searches/[id] — restricted to the search's owner.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec } from "@/lib/d1";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<{ user_id: string }>("SELECT user_id FROM saved_searches WHERE id = ?", [id]);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rows[0].user_id !== user.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  await d1Exec("DELETE FROM saved_searches WHERE id = ?", [id]);
  return NextResponse.json({ success: true });
}
