/**
 * services/banners.ts — backed by Cloudflare D1 (platform_settings JSON key).
 * Same function signatures as the Firestore version.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";

export interface Banner {
  id: string; title: string; subtitle: string; ctaText: string; ctaLink: string;
  bgColor: string; isActive: boolean; order: number; createdAt: string; updatedAt: string;
}

export type BannerInput = Omit<Banner, "id" | "createdAt" | "updatedAt">;

async function loadBanners(): Promise<Banner[]> {
  const rows = await d1Query<{ value: string }>(
    "SELECT value FROM platform_settings WHERE key = 'banners'", []
  );
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as Banner[]; } catch { return []; }
}

async function saveBanners(banners: Banner[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO platform_settings (key, value, updated_at) VALUES ('banners', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify(banners), now]
  );
}

export async function getBanners(): Promise<Banner[]> {
  const banners = await loadBanners();
  return banners.sort((a, b) => a.order - b.order);
}

export async function getActiveBanners(): Promise<Banner[]> {
  return (await getBanners()).filter((b) => b.isActive);
}

export async function createBanner(input: BannerInput): Promise<string> {
  const banners = await loadBanners();
  const now = new Date().toISOString();
  const id = newId();
  banners.push({ ...input, id, createdAt: now, updatedAt: now });
  await saveBanners(banners);
  return id;
}

export async function updateBanner(id: string, input: Partial<BannerInput>): Promise<void> {
  const banners = await loadBanners();
  const now = new Date().toISOString();
  const idx = banners.findIndex((b) => b.id === id);
  if (idx === -1) return;
  banners[idx] = { ...banners[idx], ...input, updatedAt: now };
  await saveBanners(banners);
}

export async function deleteBanner(id: string): Promise<void> {
  const banners = await loadBanners();
  await saveBanners(banners.filter((b) => b.id !== id));
}

export async function toggleBanner(id: string, isActive: boolean): Promise<void> {
  await updateBanner(id, { isActive });
}
