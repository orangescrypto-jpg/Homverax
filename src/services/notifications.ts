/**
 * services/notifications.ts — backed by Cloudflare D1.
 *
 * ✅ FIX: getUserNotifications() / markNotificationRead() /
 * markAllNotificationsRead() / getUnreadCount() used to call d1Query()/
 * d1Exec() directly. Since lib/d1.ts routes *browser* D1 calls through the
 * admin/moderator-only proxy at /api/admin/d1, any regular user opening
 * their notifications bell got a silent 403 there — surfaced as an
 * always-empty "No notifications" screen. Reads/writes now go through the
 * public, user-scoped routes at /api/notifications (and /api/notifications/
 * [id]) when running in the browser. createNotification() is left calling
 * d1Exec() directly since it's only ever invoked from server-side code
 * (e.g. badges.ts run as part of a server action), where d1Exec talks to
 * Cloudflare directly rather than through the gated admin proxy.
 */

import { d1Query, d1Exec, newId } from "@/lib/d1";

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  message: string;
  isRead: boolean;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

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

function rowToNotif(row: NotifRow): AppNotification {
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

export async function getUserNotifications(
  userId: string,
  pageLimit = 30
): Promise<AppNotification[]> {
  if (typeof window !== "undefined") {
    const res = await fetch(`/api/notifications?limit=${pageLimit}`, { cache: "no-store" });
    if (!res.ok) return [];
    const { notifications } = await res.json();
    return (notifications ?? []) as AppNotification[];
  }
  const rows = await d1Query<NotifRow>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, pageLimit]
  );
  return rows.map(rowToNotif);
}

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<void> {
  const id = newId();
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO notifications (id, user_id, title, body, type, read, link, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [id, params.userId, params.title, params.body, params.type, 0, params.actionUrl ?? null, now]
  );
}

export async function markNotificationRead(notifId: string): Promise<void> {
  if (typeof window !== "undefined") {
    await fetch(`/api/notifications/${notifId}`, { method: "PATCH" });
    return;
  }
  await d1Exec("UPDATE notifications SET read = 1 WHERE id = ?", [notifId]);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (typeof window !== "undefined") {
    await fetch("/api/notifications", { method: "PATCH" });
    return;
  }
  await d1Exec("UPDATE notifications SET read = 1 WHERE user_id = ?", [userId]);
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (typeof window !== "undefined") {
    const notifs = await getUserNotifications(userId, 100);
    return notifs.filter((n) => !n.isRead).length;
  }
  const rows = await d1Query<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND read = 0",
    [userId]
  );
  return rows[0]?.cnt ?? 0;
}

// ─── Aliases for backward compatibility ──────────────────────────────────────
export const getNotifications = getUserNotifications;
export const markAllRead = markAllNotificationsRead;

