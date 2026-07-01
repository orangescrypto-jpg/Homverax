/**
 * services/adBoostService.ts — backed by Cloudflare D1 (platform_settings JSON).
 * Same function signatures as the Firestore version.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { getPlatformConfig, savePlatformConfig } from "@/services/platformSettings";
import { createClient } from "@/lib/supabase/client";

export type AdBoostPlanType = "ad_boost" | "combined_boost";
export type AdBoostPlatform = "google" | "instagram" | "facebook" | "tiktok" | "twitter";
export type AdBoostStatus = "pending" | "active" | "running" | "completed" | "cancelled";

export interface AdBoostPlan {
  id: string; name: string; planType: AdBoostPlanType; price: number;
  durationDays: number; platforms: AdBoostPlatform[]; adSpendAllocation: number;
  marginAmount: number; maxListingsPerCampaign: number; isActive: boolean; description: string;
}

export interface AdBoost {
  id: string; agentId: string; agentName: string; listingId: string; listingTitle: string;
  listingImage: string; listingLocation: string; planType: AdBoostPlanType; planName: string;
  status: AdBoostStatus; platforms: AdBoostPlatform[]; startDate?: string; endDate?: string;
  weekNumber?: number; adCreativeUrl?: string; paymentRef?: string; amountPaid: number;
  adSpendBudget: number; marginAmount: number; impressions: number; clicks: number; reach: number;
  createdAt: string; updatedAt: string;
}

export interface AdBoostReport {
  id: string; adBoostId: string; weekNumber: number; impressions: number;
  clicks: number; reach: number; spend: number; topPlatform?: string; notes?: string; createdAt: string;
}

export interface EligibilityCheck { label: string; passed: boolean; }
export interface EligibilityResult {
  eligible: boolean; reason?: string; checks?: EligibilityCheck[];
}

export interface AdBoostRevenueSummary {
  totalBoosts: number; activeBoosts: number; totalRevenue: number; marginRevenue: number;
}

async function loadBoosts(): Promise<AdBoost[]> {
  const rows = await d1Query<{ value: string }>("SELECT value FROM platform_settings WHERE key = 'ad_boosts'", []);
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as AdBoost[]; } catch { return []; }
}

async function saveBoosts(boosts: AdBoost[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("INSERT INTO platform_settings (key, value, updated_at) VALUES ('ad_boosts', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify(boosts), now]);
}

export async function checkAdBoostEnabled(): Promise<void> {
  const cfg = await getPlatformConfig();
  if (!cfg.features.enableAdBoost) throw new Error("Ad Boost is not enabled on this platform.");
}

export async function checkListingEligibility(listingId: string): Promise<EligibilityResult> {
  const rows = await d1Query<{ status: string }>("SELECT status FROM listings WHERE id = ?", [listingId]);
  if (!rows.length) return { eligible: false, reason: "Listing not found" };
  if (rows[0].status !== "active") return { eligible: false, reason: "Listing must be active" };
  return { eligible: true };
}

export async function getAdBoostPlans(): Promise<AdBoostPlan[]> {
  const rows = await d1Query<{ value: string }>("SELECT value FROM platform_settings WHERE key = 'ad_boost_plans'", []);
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as AdBoostPlan[]; } catch { return []; }
}

export async function createAdBoost(params: {
  agentId: string; agentName: string; listingId: string; listingTitle: string;
  listingImage: string; listingLocation: string; planType: AdBoostPlanType; planName: string;
  platforms: AdBoostPlatform[]; amountPaid: number; adSpendBudget: number; marginAmount: number; paymentRef?: string;
}): Promise<AdBoost> {
  const boosts = await loadBoosts();
  const now = new Date().toISOString();
  const boost: AdBoost = {
    ...params, id: newId(), status: "pending",
    impressions: 0, clicks: 0, reach: 0, createdAt: now, updatedAt: now,
  };
  boosts.push(boost);
  await saveBoosts(boosts);
  return boost;
}

export async function getMyAdBoosts(agentId: string): Promise<AdBoost[]> {
  const boosts = await loadBoosts();
  return boosts.filter((b) => b.agentId === agentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function subscribeToMyAdBoosts(agentId: string, callback: (boosts: AdBoost[]) => void): () => void {
  // Realtime via Supabase — poll every 30s as fallback
  const interval = setInterval(async () => {
    const boosts = await getMyAdBoosts(agentId);
    callback(boosts);
  }, 30000);
  return () => clearInterval(interval);
}

export async function getBoostReport(adBoostId: string): Promise<AdBoostReport[]> {
  const rows = await d1Query<{ value: string }>("SELECT value FROM platform_settings WHERE key = ?", [`adreport:${adBoostId}`]);
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as AdBoostReport[]; } catch { return []; }
}

export async function cancelAdBoost(adBoostId: string, agentId: string): Promise<void> {
  const boosts = await loadBoosts();
  const idx = boosts.findIndex((b) => b.id === adBoostId && b.agentId === agentId);
  if (idx === -1) throw new Error("Ad Boost not found");
  boosts[idx] = { ...boosts[idx], status: "cancelled", updatedAt: new Date().toISOString() };
  await saveBoosts(boosts);
}

export async function adminGetAllAdBoosts(status?: AdBoostStatus): Promise<AdBoost[]> {
  const boosts = await loadBoosts();
  return (status ? boosts.filter((b) => b.status === status) : boosts)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function adminUpdateBoostStatus(id: string, status: AdBoostStatus, extra?: Partial<AdBoost>): Promise<void> {
  const boosts = await loadBoosts();
  const idx = boosts.findIndex((b) => b.id === id);
  if (idx === -1) return;
  boosts[idx] = { ...boosts[idx], ...extra, status, updatedAt: new Date().toISOString() };
  await saveBoosts(boosts);
}

export async function adminAddBoostReport(adBoostId: string, report: Omit<AdBoostReport, "id" | "adBoostId" | "createdAt">): Promise<void> {
  const reports = await getBoostReport(adBoostId);
  reports.push({ ...report, id: newId(), adBoostId, createdAt: new Date().toISOString() });
  const now = new Date().toISOString();
  await d1Exec("INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [`adreport:${adBoostId}`, JSON.stringify(reports), now]);
  const boosts = await loadBoosts();
  const idx = boosts.findIndex((b) => b.id === adBoostId);
  if (idx > -1) {
    boosts[idx].impressions += report.impressions;
    boosts[idx].clicks += report.clicks;
    boosts[idx].reach += report.reach;
    boosts[idx].updatedAt = now;
    await saveBoosts(boosts);
  }
}

export async function adminToggleAdBoost(enabled: boolean, adminId: string, adminName: string): Promise<void> {
  const cfg = await getPlatformConfig();
  await savePlatformConfig({ features: { ...cfg.features, enableAdBoost: enabled } }, adminId, adminName);
}

export async function getAdBoostRevenueSummary(): Promise<AdBoostRevenueSummary> {
  const boosts = await loadBoosts();
  const active = boosts.filter((b) => b.status === "active" || b.status === "running");
  return {
    totalBoosts: boosts.length,
    activeBoosts: active.length,
    totalRevenue: boosts.reduce((s, b) => s + b.amountPaid, 0),
    marginRevenue: boosts.reduce((s, b) => s + b.marginAmount, 0),
  };
}

// ─── Extended exports required by pages ──────────────────────────────────────

export class FeatureDisabledError extends Error {
  constructor(message = "Feature is disabled") {
    super(message);
    this.name = "FeatureDisabledError";
  }
}

// Re-export extended summary shape pages depend on
export type AdBoostRevenueSummaryExtended = AdBoostRevenueSummary & {
  totalCollected: number;
  totalAdSpend: number;
  totalMargin: number;
  runningCount: number;
};

export async function getAdBoostRevenueSummaryExtended(): Promise<AdBoostRevenueSummaryExtended> {
  const base = await getAdBoostRevenueSummary();
  const boosts = await adminGetAllAdBoosts();
  const running = boosts.filter((b) => b.status === "running" || b.status === "active");
  return {
    ...base,
    totalCollected: base.totalRevenue,
    totalAdSpend:   boosts.reduce((s, b) => s + b.adSpendBudget, 0),
    totalMargin:    base.marginRevenue,
    runningCount:   running.length,
  };
}
