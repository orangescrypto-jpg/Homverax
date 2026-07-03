/**
 * app/api/conversations/route.ts
 * GET /api/conversations — the signed-in user's conversation list.
 *
 * ✅ FIX: getMyConversations() in services/messages.ts called d1Query()
 * directly from client dashboard code (TenantDashboard, etc), silently
 * blocked for non-staff users. This route covers just that read — the
 * rest of messages.ts (sendMessage, markConversationRead,
 * getConversationMessages, offer-in-chat functions) still needs the same
 * treatment; not covered in this pass.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";

interface MsgRow { conversation_id: string; content: string; created_at: string; }

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<MsgRow>(
    "SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? GROUP BY conversation_id ORDER BY created_at DESC",
    [user.id, user.id]
  );
  const convMap = new Map<string, unknown>();
  for (const row of rows) {
    if (!convMap.has(row.conversation_id)) {
      convMap.set(row.conversation_id, {
        id: row.conversation_id, participants: [], lastMessage: row.content,
        lastMessageAt: row.created_at, unreadCount: 0, unreadFor: null,
      });
    }
  }
  return NextResponse.json({ conversations: Array.from(convMap.values()) });
}
