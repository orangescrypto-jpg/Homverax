/**
 * services/analytics.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */
import { d1Query, d1Exec } from "@/lib/d1";

export interface ListingAnalytics {
  listingId: string; views: number; uniqueViews: number; saves: number;
  inquiries: number; offers: number; escrows: number; conversionRate: number;
  viewsThisWeek: number; viewsThisMonth: number; lastViewedAt?: string; updatedAt: string;
}

export interface PlatformAnalytics {
  totalListings: number; activeListings: number; totalUsers: number;
  totalEscrows: number; escrowValueHeld: number; escrowValueReleased: number;
  totalRevenue: number; monthlyRevenue: number; pendingVerifications: number;
  pendingPayouts: number; newUsersThisMonth: number; newListingsThisMonth: number;
}

export async function trackListingView(listingId: string, _viewerId?: string): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("UPDATE listings SET views = views + 1, updated_at = ? WHERE id = ?", [now, listingId]);
}

export async function trackListingSave(listingId: string, saved: boolean): Promise<void> {
  const now = new Date().toISOString();
  const delta = saved ? 1 : -1;
  await d1Exec("UPDATE listings SET saves = MAX(0, saves + ?), updated_at = ? WHERE id = ?", [delta, now, listingId]);
}

export async function trackListingInquiry(_listingId: string): Promise<void> { /* tracked via messages */ }
export async function trackListingOffer(_listingId: string): Promise<void> { /* tracked via offers */ }
export async function trackListingEscrow(_listingId: string): Promise<void> { /* tracked via escrows */ }

export async function getListingAnalytics(listingId: string): Promise<ListingAnalytics> {
  const rows = await d1Query<{ views: number; saves: number; updated_at: string }>(
    "SELECT views, saves, updated_at FROM listings WHERE id = ?", [listingId]
  );
  const l = rows[0] ?? { views: 0, saves: 0, updated_at: new Date().toISOString() };
  return {
    listingId, views: l.views, uniqueViews: l.views, saves: l.saves,
    inquiries: 0, offers: 0, escrows: 0, conversionRate: 0,
    viewsThisWeek: 0, viewsThisMonth: 0, updatedAt: l.updated_at,
  };
}

export async function getMultipleListingAnalytics(listingIds: string[]): Promise<ListingAnalytics[]> {
  return Promise.all(listingIds.map(getListingAnalytics));
}

export async function recordPriceChange(_listingId: string, _oldPrice: number, _newPrice: number): Promise<void> { }

export async function getPriceHistory(_listingId: string): Promise<{ price: number; date: string }[]> {
  return [];
}
