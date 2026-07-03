/**
 * app/api/conversations/[id]/messages/route.ts
 * GET  /api/conversations/[id]/messages — fetch a conversation's messages
 * POST /api/conversations/[id]/messages — send a message
 *
 * ✅ FIX: sendMessage() / getConversationMessages() in services/messages.ts
 * called d1Exec()/d1Query() directly from client chat components. Since
 * lib/d1.ts routes browser D1 calls through the admin/moderator-only proxy
 * at /api/admin/d1, this meant NO regular user could send or read chat
 * messages at all — every send/read silently 403'd. This route does the
 * same DB work server-side, gated only to "signed in and is sender or
 * receiver on this conversation" (checked against the conversation's own
 * message history), not "is staff".
 *
 * Also fires an in-app notification to the recipient on send
 * (fire-and-forget, never blocks the send).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { createNotification } from "@/services/notifications";

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

function rowToMessage(row: MsgRow) {
  let content = row.content;
  let type = "text";
  let offerData: unknown = null;
  try {
    const parsed = JSON.parse(row.content) as { _type?: string; _offerData?: unknown; _text?: string };
    if (parsed._type) { type = parsed._type; offerData = parsed._offerData ?? null; content = parsed._text ?? ""; }
  } catch {}
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content,
    readAt: row.read === 1 ? row.created_at : undefined,
    createdAt: row.created_at,
    type,
    offerData,
  };
}

// Confirms the signed-in user is actually a participant in this
// conversation (has at least one message as sender or receiver), and
// returns that message set for further checks.
async function requireParticipant(conversationId: string, userId: string) {
  const rows = await d1Query<MsgRow>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [conversationId]
  );
  if (rows.length && !rows.some((r) => r.sender_id === userId || r.receiver_id === userId)) {
    return { error: "Forbidden" as const, status: 403 as const };
  }
  return { rows };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await requireParticipant(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ messages: result.rows.map(rowToMessage) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.receiverId || !body?.content) {
    return NextResponse.json({ error: "Missing receiverId or content" }, { status: 400 });
  }

  // For a brand-new conversation there are no prior rows yet, so
  // requireParticipant only blocks impersonation of an existing thread —
  // it never blocks starting a fresh one.
  const result = await requireParticipant(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const msgId = newId();
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, content, read, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [msgId, id, user.id, body.receiverId, body.listingId ?? null, body.content, 0, now]
  );

  // ── In-app notification for the recipient ────────────────────────────────
  // Fire-and-forget — a failed notification must never block the send.
  try {
    let preview = String(body.content);
    try {
      const parsed = JSON.parse(preview) as { _type?: string; _text?: string };
      if (parsed._type) preview = parsed._text ?? "Sent an offer";
    } catch {}
    if (preview.length > 120) preview = preview.slice(0, 117) + "…";

    const [senderRow] = await d1Query<{ name: string }>("SELECT name FROM users WHERE id = ?", [user.id]);
    void createNotification({
      userId: body.receiverId,
      type: "message",
      title: `New message from ${senderRow?.name ?? "someone"}`,
      body: preview,
      actionUrl: `/dashboard/messages/${id}`,
    });
  } catch (err) {
    console.warn("[conversations/messages POST] notification error:", err);
  }

  return NextResponse.json({
    message: rowToMessage({
      id: msgId,
      conversation_id: id,
      sender_id: user.id,
      receiver_id: body.receiverId,
      listing_id: body.listingId ?? null,
      content: body.content,
      read: 0,
      created_at: now,
    }),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await requireParticipant(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Mark-read only ever applies to messages the signed-in user received.
  await d1Exec(
    "UPDATE messages SET read = 1 WHERE conversation_id = ? AND receiver_id = ?",
    [id, user.id]
  );

  return NextResponse.json({ ok: true });
}
