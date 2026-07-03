/**
 * app/api/admin/conversations/[id]/messages/route.ts
 * GET  /api/admin/conversations/[id]/messages — full thread for one
 *      conversation, for staff review.
 * POST /api/admin/conversations/[id]/messages — send a reply into the
 *      thread as the signed-in admin/moderator, addressed to whichever
 *      participant isn't staff. Mirrors the write to Supabase so the
 *      user's own chat UI (which subscribes via subscribeToMessages)
 *      receives it in realtime, same as a normal user-to-user message.
 * Admin/moderator only (mirrors the auth pattern used by /api/admin/d1).
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

interface UserRow {
  id: string;
  name: string | null;
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

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" as const, status: 401 as const };
  const role = (user.user_metadata?.role as string | undefined) ?? "";
  if (role !== "admin" && role !== "moderator") return { error: "Forbidden" as const, status: 403 as const };
  return { user };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;

  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rows = await d1Query<MsgRow>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [conversationId]
  );

  const userIds = Array.from(new Set(rows.flatMap((r) => [r.sender_id, r.receiver_id])));
  const usersById = new Map<string, UserRow>();
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => "?").join(",");
    const userRows = await d1Query<UserRow>(
      `SELECT id, name, email, avatar_url FROM users WHERE id IN (${placeholders})`,
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
      senderName: sender?.name ?? sender?.email ?? "Unknown user",
      content: text,
      type,
      readAt: row.read === 1 ? row.created_at : undefined,
      createdAt: row.created_at,
    };
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;

  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { user } = auth;

  const body = await request.json().catch(() => null);
  const content = (body?.content ?? "").toString().trim();
  if (!content) return NextResponse.json({ error: "Missing content" }, { status: 400 });

  // Figure out who the reply goes to: the other participant in the
  // existing thread. If receiverId is passed explicitly (e.g. the admin
  // is starting a fresh thread), use that instead.
  let receiverId: string | undefined = body?.receiverId;
  let listingId: string | null = body?.listingId ?? null;
  if (!receiverId) {
    const existing = await d1Query<MsgRow>(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 1",
      [conversationId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: "receiverId is required for a new conversation" }, { status: 400 });
    }
    const first = existing[0];
    receiverId = first.sender_id === user.id ? first.receiver_id : first.sender_id;
    listingId = listingId ?? first.listing_id;
  }

  const msgId = newId();
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, content, read, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [msgId, conversationId, user.id, receiverId, listingId, content, 0, now]
  );

  // Mirror to Supabase so the recipient's realtime subscription (see
  // subscribeToMessages in services/messages.ts) picks this up live,
  // exactly like a normal user-to-user message would.
  try {
    const supabase = await createClient();
    const { error: mirrorError } = await supabase.from("messages").insert({
      id: msgId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      created_at: now,
    });
    if (mirrorError) {
      console.warn("[admin/conversations/messages POST] Supabase mirror error:", mirrorError.message);
    }
  } catch (err) {
    console.warn("[admin/conversations/messages POST] Supabase mirror failed:", err);
  }

  // In-app notification for the recipient — fire-and-forget.
  try {
    let preview = content;
    if (preview.length > 120) preview = preview.slice(0, 117) + "…";
    void createNotification({
      userId: receiverId,
      type: "message",
      title: "New message from HomveraX Support",
      body: preview,
      actionUrl: `/dashboard/messages/${conversationId}`,
    });
  } catch (err) {
    console.warn("[admin/conversations/messages POST] notification error:", err);
  }

  return NextResponse.json({
    message: {
      id: msgId,
      conversationId,
      senderId: user.id,
      senderName: "HomveraX Support",
      content,
      type: "text",
      readAt: undefined,
      createdAt: now,
    },
  });
}
