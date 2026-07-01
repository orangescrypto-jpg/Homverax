/**
 * services/notifications.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
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
  await d1Exec("UPDATE notifications SET read = 1 WHERE id = ?", [notifId]);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await d1Exec("UPDATE notifications SET read = 1 WHERE user_id = ?", [userId]);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await d1Query<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND read = 0",
    [userId]
  );
  return rows[0]?.cnt ?? 0;
}

// ─── Aliases for backward compatibility ──────────────────────────────────────
export const getNotifications = getUserNotifications;
export const markAllRead = markAllNotificationsRead;

