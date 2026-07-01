/**
 * services/badges.ts — backed by Cloudflare D1 (platform_settings JSON).
 * Same types, exports, and function signatures as the Firestore version.
 */
import { d1Query, d1Exec } from "@/lib/d1";
import { createNotification } from "@/services/notifications";

export type BadgeId =
  | "first_deal" | "trusted_buyer" | "power_buyer" | "loyal_buyer"
  | "first_sale"  | "active_seller" | "top_seller"  | "elite_seller"
  | "verified_agent" | "fast_responder" | "five_star_rated";

export interface Badge {
  id: BadgeId; label: string; description: string; icon: string; color: string; earnedAt: string;
}

export interface UserBadges {
  userId: string; badges: Badge[]; updatedAt: string;
}

export const BADGE_DEFS: Record<BadgeId, Omit<Badge, "earnedAt">> = {
  first_deal:      { id: "first_deal",      label: "First Deal",       description: "Completed your first escrow purchase",              icon: "🎉", color: "text-blue-600 bg-blue-100" },
  trusted_buyer:   { id: "trusted_buyer",   label: "Trusted Buyer",    description: "Completed 3 successful escrow deals",               icon: "✅", color: "text-green-600 bg-green-100" },
  power_buyer:     { id: "power_buyer",     label: "Power Buyer",      description: "Completed 10 escrow deals",                        icon: "⚡", color: "text-purple-600 bg-purple-100" },
  loyal_buyer:     { id: "loyal_buyer",     label: "Loyal Buyer",      description: "Completed 25 escrow deals — top tier buyer",        icon: "👑", color: "text-amber-600 bg-amber-100" },
  first_sale:      { id: "first_sale",      label: "First Sale",       description: "Completed your first escrow sale",                  icon: "🏆", color: "text-blue-600 bg-blue-100" },
  active_seller:   { id: "active_seller",   label: "Active Seller",    description: "Completed 5 successful escrow sales",               icon: "🔥", color: "text-orange-600 bg-orange-100" },
  top_seller:      { id: "top_seller",      label: "Top Seller",       description: "Completed 20 escrow sales",                        icon: "⭐", color: "text-yellow-600 bg-yellow-100" },
  elite_seller:    { id: "elite_seller",    label: "Elite Seller",     description: "Completed 50 escrow sales — platform top 1%",       icon: "💎", color: "text-indigo-600 bg-indigo-100" },
  verified_agent:  { id: "verified_agent",  label: "Verified Agent",   description: "Completed identity and property verification",       icon: "🛡️", color: "text-teal-600 bg-teal-100" },
  fast_responder:  { id: "fast_responder",  label: "Fast Responder",   description: "Responds to messages within 1 hour consistently",   icon: "⚡", color: "text-cyan-600 bg-cyan-100" },
  five_star_rated: { id: "five_star_rated", label: "5-Star Rated",     description: "Maintains a 5.0 average rating",                   icon: "🌟", color: "text-amber-600 bg-amber-100" },
};

async function loadUserBadges(userId: string): Promise<Badge[]> {
  const rows = await d1Query<{ value: string }>(
    "SELECT value FROM platform_settings WHERE key = ?", [`badges:${userId}`]
  );
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as Badge[]; } catch { return []; }
}

async function saveUserBadges(userId: string, badges: Badge[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [`badges:${userId}`, JSON.stringify(badges), now]
  );
}

export async function getUserBadges(userId: string): Promise<Badge[]> {
  return loadUserBadges(userId);
}

export async function awardBadge(userId: string, badgeId: BadgeId): Promise<boolean> {
  const existing = await loadUserBadges(userId);
  if (existing.some((b) => b.id === badgeId)) return false;

  const def = BADGE_DEFS[badgeId];
  if (!def) return false;

  const newBadge: Badge = { ...def, earnedAt: new Date().toISOString() };
  await saveUserBadges(userId, [...existing, newBadge]);

  await createNotification({
    userId,
    type: "system",
    title: `${def.icon} Badge Earned: ${def.label}`,
    body: def.description,
    actionUrl: "/dashboard/badges",
  });

  return true;
}

export async function checkAndAwardBadges(userId: string, role: "buyer" | "seller"): Promise<BadgeId[]> {
  const awarded: BadgeId[] = [];

  if (role === "buyer") {
    const rows = await d1Query<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM escrows WHERE buyer_id = ? AND status = 'released'", [userId]
    );
    const count = rows[0]?.cnt ?? 0;
    for (const [threshold, badgeId] of [[1, "first_deal"], [3, "trusted_buyer"], [10, "power_buyer"], [25, "loyal_buyer"]] as [number, BadgeId][]) {
      if (count >= threshold && await awardBadge(userId, badgeId)) awarded.push(badgeId);
    }
  }

  if (role === "seller") {
    const rows = await d1Query<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM escrows WHERE seller_id = ? AND status = 'released'", [userId]
    );
    const count = rows[0]?.cnt ?? 0;
    for (const [threshold, badgeId] of [[1, "first_sale"], [5, "active_seller"], [20, "top_seller"], [50, "elite_seller"]] as [number, BadgeId][]) {
      if (count >= threshold && await awardBadge(userId, badgeId)) awarded.push(badgeId);
    }
  }

  return awarded;
}

export async function revokeBadge(userId: string, badgeId: BadgeId): Promise<void> {
  const badges = await loadUserBadges(userId);
  await saveUserBadges(userId, badges.filter((b) => b.id !== badgeId));
}
