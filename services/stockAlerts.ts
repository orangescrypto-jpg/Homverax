/**
 * services/stockAlerts.ts — backed by Cloudflare D1.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { getPlatformConfig } from "@/services/platformSettings";

export type AlertType =
  | "high_views_no_inquiry" | "high_views_no_booking" | "high_saves_no_contact"
  | "price_drop_suggestion" | "listing_stale";

export interface StockAlert {
  id: string; listingId: string; listingTitle: string; agentId: string;
  type: AlertType; message: string; suggestion: string; isRead: boolean; isDismissed: boolean; createdAt: string;
}

const ALERT_MESSAGES: Record<AlertType, { message: string; suggestion: string }> = {
  high_views_no_inquiry:  { message: "High views, no inquiries", suggestion: "Check your contact details or try lowering the price slightly." },
  high_views_no_booking:  { message: "Many views, no viewing requests", suggestion: "Add more photos, a virtual tour link, or highlight key features." },
  high_saves_no_contact:  { message: "Saved frequently but no messages", suggestion: "A slight price reduction or better description may convert them." },
  price_drop_suggestion:  { message: "Listing may be overpriced for the area", suggestion: "A 5-10% price reduction could significantly increase inquiries." },
  listing_stale:          { message: "No activity in 30+ days", suggestion: "Refresh your listing with updated photos or apply a boost." },
};

async function loadAlerts(agentId: string): Promise<StockAlert[]> {
  const rows = await d1Query<{ value: string }>("SELECT value FROM platform_settings WHERE key = ?", [`alerts:${agentId}`]);
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as StockAlert[]; } catch { return []; }
}

async function saveAlerts(agentId: string, alerts: StockAlert[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [`alerts:${agentId}`, JSON.stringify(alerts), now]);
}

export async function createStockAlert(params: {
  listingId: string; listingTitle: string; agentId: string; type: AlertType;
}): Promise<void> {
  const alerts = await loadAlerts(params.agentId);
  if (alerts.find((a) => a.listingId === params.listingId && a.type === params.type && !a.isDismissed)) return;
  const def = ALERT_MESSAGES[params.type];
  alerts.push({ id: newId(), ...params, ...def, isRead: false, isDismissed: false, createdAt: new Date().toISOString() });
  await saveAlerts(params.agentId, alerts);
}

export async function getMyStockAlerts(agentId: string): Promise<StockAlert[]> {
  const alerts = await loadAlerts(agentId);
  return alerts.filter((a) => !a.isDismissed).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function dismissStockAlert(alertId: string): Promise<void> {
  // Find alert across all agents
  const rows = await d1Query<{ key: string; value: string }>(
    "SELECT key, value FROM platform_settings WHERE key LIKE 'alerts:%'", []
  );
  for (const row of rows) {
    try {
      const alerts = JSON.parse(row.value) as StockAlert[];
      const idx = alerts.findIndex((a) => a.id === alertId);
      if (idx > -1) {
        alerts[idx].isDismissed = true;
        const now = new Date().toISOString();
        await d1Exec("UPDATE platform_settings SET value = ?, updated_at = ? WHERE key = ?", [JSON.stringify(alerts), now, row.key]);
        return;
      }
    } catch {}
  }
}

export async function checkListingsForAlerts(agentId: string): Promise<void> {
  const cfg = await getPlatformConfig();
  const t = cfg.stockAlertThresholds;
  const listings = await d1Query<{ id: string; title: string; views: number; saves: number; created_at: string }>(
    "SELECT id, title, views, saves, created_at FROM listings WHERE agent_id = ? AND status = 'active'",
    [agentId]
  );
  for (const l of listings) {
    if (l.views >= (t?.highViewsNoInquiry ?? 100)) {
      await createStockAlert({ listingId: l.id, listingTitle: l.title, agentId, type: "high_views_no_inquiry" });
    }
    if (l.saves >= (t?.highSavesNoContact ?? 20)) {
      await createStockAlert({ listingId: l.id, listingTitle: l.title, agentId, type: "high_saves_no_contact" });
    }
    const daysSince = (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= (t?.staleDays ?? 30) && l.views < 10) {
      await createStockAlert({ listingId: l.id, listingTitle: l.title, agentId, type: "listing_stale" });
    }
  }
}
