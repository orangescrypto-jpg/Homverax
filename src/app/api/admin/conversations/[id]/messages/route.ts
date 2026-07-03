/**
 * app/api/admin/conversations/[id]/messages/route.ts
 * GET /api/admin/conversations/[id]/messages — full thread for one
 * conversation, for staff review. Admin/moderator only, read-only
 * (mirrors the auth pattern used by /api/admin/d1).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";

interface MsgRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  listing_id: string | null;
  content: string;
  read: number;
  created_at: string;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

function parseContent(raw: string): { text: string; type: string } {
  try {
    const parsed = JSON.parse(raw) as { _type?: string; _text?: string };
    if (parsed._type) return { text: parsed._text ?? "", type: parsed._type };
  } catch {
    // plain text
  }
  return { text: raw, type: "text" };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (user.user_metadata?.role as string | undefined) ?? "";
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await d1Query<MsgRow>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [conversationId]
  );

  const userIds = Array.from(new Set(rows.flatMap((r) => [r.sender_id, r.receiver_id])));
  const usersById = new Map<string, UserRow>();
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => "?").join(",");
    const userRows = await d1Query<UserRow>(
      `SELECT id, full_name, email, avatar_url FROM users WHERE id IN (${placeholders})`,
      userIds
    );
    for (const u of userRows) usersById.set(u.id, u);
  }

  const messages = rows.map((row) => {
    const { text, type } = parseContent(row.content);
    const sender = usersById.get(row.sender_id);
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderName: sender?.full_name ?? sender?.email ?? "Unknown user",
      content: text,
      type,
      readAt: row.read === 1 ? row.created_at : undefined,
      createdAt: row.created_at,
    };
  });

  return NextResponse.json({ messages });
}
