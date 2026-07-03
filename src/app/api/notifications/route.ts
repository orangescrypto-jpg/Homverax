/**
 * app/api/notifications/route.ts
 * GET   /api/notifications          — list the signed-in user's notifications
 * PATCH /api/notifications          — mark all of the signed-in user's notifications read
 *
 * ✅ FIX: services/notifications.ts used to call d1Query()/d1Exec() directly
 * from the client. Since lib/d1.ts routes browser D1 calls through the
 * admin/moderator-only proxy at /api/admin/d1, this meant any regular user
 * opening their notifications bell got a silent 403 — surfaced as an
 * always-empty "No notifications / You're all caught up!" screen, even when
 * rows existed for them in the database. This route does the same DB work
 * server-side, scoped only to "signed in", reading/writing just that user's
 * own rows — not "is staff".
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec } from "@/lib/d1";

interface NotifRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string | null;
  read: number;
  link: string | null;
  created_at: string;
}

function rowToNotif(row: NotifRow) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type ?? "system",
    title: row.title,
    body: row.body,
    message: row.body,
    isRead: row.read === 1,
    read: row.read === 1,
    actionUrl: row.link ?? undefined,
    createdAt: row.created_at,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 30, 100) : 30;

  const rows = await d1Query<NotifRow>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [user.id, limit]
  );
  return NextResponse.json({ notifications: rows.map(rowToNotif) });
}

export async function PATCH(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only supported action right now: mark all read
  await d1Exec("UPDATE notifications SET read = 1 WHERE user_id = ?", [user.id]);
  return NextResponse.json({ ok: true });
}
