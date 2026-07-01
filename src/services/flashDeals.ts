/**
 * services/flashDeals.ts — backed by Cloudflare D1.
 */
import { d1Query, d1Exec } from "@/lib/d1";
import { getPlatformConfig } from "@/services/platformSettings";

export interface FlashDeal {
  listingId: string; listingTitle: string; originalPrice: number; flashPrice: number;
  discountPercent: number; endsAt: string; agentId: string;
  category?: string; images?: string[]; location?: { state: string; lga?: string };
  listingType?: string; priceUnit?: string;
}

export async function setFlashDeal(params: {
  listingId: string; agentId: string; flashPrice: number; durationHours: number;
}): Promise<void> {
  const cfg = await getPlatformConfig();
  if (!cfg.features.enableFlashDeals) throw new Error("Flash deals are not enabled");

  const rows = await d1Query<{ agent_id: string; price: number }>(
    "SELECT agent_id, price FROM listings WHERE id = ?", [params.listingId]
  );
  if (!rows.length) throw new Error("Listing not found");
  if (rows[0].agent_id !== params.agentId) throw new Error("Not your listing");

  const originalPrice = rows[0].price;
  const discountPercent = Math.round(((originalPrice - params.flashPrice) / originalPrice) * 100);
  const maxDiscount = cfg.flashDealMaxDiscountPercent ?? 70;
  const maxHours = cfg.flashDealMaxDurationHours ?? 168;

  if (discountPercent > maxDiscount) throw new Error(`Maximum discount is ${maxDiscount}%`);
  if (params.durationHours > maxHours) throw new Error(`Maximum duration is ${maxHours} hours`);
  if (params.flashPrice >= originalPrice) throw new Error("Flash price must be lower than listing price");

  const endsAt = new Date(Date.now() + params.durationHours * 3600 * 1000).toISOString();
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE listings SET is_flash_deal = 1, flash_deal_price = ?, flash_deal_expires_at = ?, updated_at = ? WHERE id = ?",
    [params.flashPrice, endsAt, now, params.listingId]
  );
}

export async function removeFlashDeal(listingId: string, agentId: string): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE listings SET is_flash_deal = 0, flash_deal_price = NULL, flash_deal_expires_at = NULL, updated_at = ? WHERE id = ? AND agent_id = ?",
    [now, listingId, agentId]
  );
}

export async function getActiveFlashDeals(pageLimit = 20): Promise<FlashDeal[]> {
  const now = new Date().toISOString();
  const rows = await d1Query<{
    id: string; title: string; price: number; flash_deal_price: number; flash_deal_expires_at: string;
    agent_id: string; category: string; images: string; state: string; lga: string; listing_type: string; price_unit: string;
  }>(
    "SELECT id, title, price, flash_deal_price, flash_deal_expires_at, agent_id, category, images, state, lga, listing_type, price_unit FROM listings WHERE is_flash_deal = 1 AND flash_deal_expires_at > ? AND status = 'active' ORDER BY flash_deal_expires_at ASC LIMIT ?",
    [now, pageLimit]
  );
  return rows.map((r) => {
    let images: string[] = [];
    try { images = JSON.parse(r.images || "[]"); } catch {}
    const discountPercent = Math.round(((r.price - r.flash_deal_price) / r.price) * 100);
    return {
      listingId: r.id, listingTitle: r.title, originalPrice: r.price, flashPrice: r.flash_deal_price,
      discountPercent, endsAt: r.flash_deal_expires_at, agentId: r.agent_id,
      category: r.category, images, location: { state: r.state, lga: r.lga },
      listingType: r.listing_type, priceUnit: r.price_unit,
    };
  });
}

export async function expireOverdueFlashDeals(): Promise<number> {
  const now = new Date().toISOString();
  const rows = await d1Query<{ id: string }>(
    "SELECT id FROM listings WHERE is_flash_deal = 1 AND flash_deal_expires_at <= ?", [now]
  );
  for (const row of rows) {
    await d1Exec("UPDATE listings SET is_flash_deal = 0, flash_deal_price = NULL, flash_deal_expires_at = NULL WHERE id = ?", [row.id]);
  }
  return rows.length;
}
