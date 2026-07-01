/**
 * services/referral.ts — backed by Cloudflare D1 (platform_settings JSON).
 * Same function signatures as the Firestore version.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { getPlatformConfig } from "@/services/platformSettings";

export type ReferralEarningType = "signup" | "welcome" | "first_transaction" | "recurring";
export type ReferredUserRole = "agent" | "landlord" | "service_provider" | "tenant";

export interface ReferralProfile {
  userId: string; referralCode: string; totalEarnings: number; pendingBalance: number;
  withdrawnTotal: number; totalReferrals: number; convertedReferrals: number; createdAt: string;
}

export interface ReferralEarning {
  id: string; userId: string; referredUserId: string; referredUserName: string;
  type: ReferralEarningType; amount: number; escrowId?: string; isFirstTransaction?: boolean; createdAt: string;
}

export interface ReferralLink {
  referrerId: string; referredUserId: string; referredUserName: string; referredUserRole: ReferredUserRole;
  code: string; status: "pending" | "converted"; firstTransactionDone: boolean; createdAt: string; convertedAt?: string;
}

export interface WithdrawalRequest {
  id: string; userId: string; userName: string; amount: number; bankName: string;
  accountNumber: string; accountName: string; status: "pending" | "approved" | "rejected";
  note?: string; createdAt: string; processedAt?: string;
}

export interface ReferralConfig {
  signupBonus: number;
  transactionBonus: number;
  transactionPercent: number;
  usePercent: boolean;
  minimumWithdrawal: number;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = { signupBonus: 500, transactionBonus: 1000, transactionPercent: 2, usePercent: false, minimumWithdrawal: 5000 };

async function loadKey<T>(key: string, fallback: T): Promise<T> {
  const rows = await d1Query<{ value: string }>("SELECT value FROM platform_settings WHERE key = ?", [key]);
  if (!rows.length) return fallback;
  try { return JSON.parse(rows[0].value) as T; } catch { return fallback; }
}

async function saveKey<T>(key: string, value: T): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [key, JSON.stringify(value), now]);
}

function generateCode(userId: string): string {
  return userId.slice(-6).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

export async function getOrCreateReferralProfile(userId: string, _userName: string): Promise<ReferralProfile> {
  const existing = await loadKey<ReferralProfile | null>(`referral:${userId}`, null);
  if (existing) return existing;
  const profile: ReferralProfile = {
    userId, referralCode: generateCode(userId), totalEarnings: 0, pendingBalance: 0,
    withdrawnTotal: 0, totalReferrals: 0, convertedReferrals: 0, createdAt: new Date().toISOString(),
  };
  await saveKey(`referral:${userId}`, profile);
  await saveKey(`refcode:${profile.referralCode}`, userId);
  return profile;
}

export async function findReferrerByCode(code: string): Promise<string | null> {
  return loadKey<string | null>(`refcode:${code.toUpperCase()}`, null);
}

export async function recordReferralLink(referrerId: string, referredUserId: string, referredUserName: string, referredUserRole: ReferredUserRole, code: string): Promise<void> {
  const links = await loadKey<ReferralLink[]>(`reflinks:${referrerId}`, []);
  if (links.find((l) => l.referredUserId === referredUserId)) return;
  links.push({ referrerId, referredUserId, referredUserName, referredUserRole, code, status: "pending", firstTransactionDone: false, createdAt: new Date().toISOString() });
  await saveKey(`reflinks:${referrerId}`, links);
  const profile = await loadKey<ReferralProfile | null>(`referral:${referrerId}`, null);
  if (profile) await saveKey(`referral:${referrerId}`, { ...profile, totalReferrals: profile.totalReferrals + 1 });
}

export async function updateReferralRole(referrerId: string, referredUserId: string, role: ReferredUserRole): Promise<void> {
  const links = await loadKey<ReferralLink[]>(`reflinks:${referrerId}`, []);
  const idx = links.findIndex((l) => l.referredUserId === referredUserId);
  if (idx > -1) { links[idx].referredUserRole = role; await saveKey(`reflinks:${referrerId}`, links); }
}

async function creditEarning(userId: string, type: ReferralEarningType, amount: number, referredUserId: string, referredUserName: string, escrowId?: string): Promise<void> {
  if (amount <= 0) return;
  const earnings = await loadKey<ReferralEarning[]>(`refearnings:${userId}`, []);
  const now = new Date().toISOString();
  earnings.push({ id: newId(), userId, referredUserId, referredUserName, type, amount, escrowId, createdAt: now });
  await saveKey(`refearnings:${userId}`, earnings);
  const profile = await loadKey<ReferralProfile | null>(`referral:${userId}`, null);
  if (profile) await saveKey(`referral:${userId}`, { ...profile, totalEarnings: profile.totalEarnings + amount, pendingBalance: profile.pendingBalance + amount });
}

export async function creditSignupBonus(referrerId: string, referredUserId: string, referredUserName: string): Promise<void> {
  const cfg = await getPlatformConfig();
  if (!cfg.referralTiers.signupBonusEnabled) return;
  await creditEarning(referrerId, "signup", cfg.referralTiers.signupBonusAmount, referredUserId, referredUserName);
}

export async function creditWelcomeBonus(referredUserId: string, referrerName: string): Promise<void> {
  const cfg = await getPlatformConfig();
  if (!cfg.referralTiers.welcomeBonusEnabled) return;
  await creditEarning(referredUserId, "welcome", cfg.referralTiers.welcomeBonusAmount, referredUserId, referrerName);
}

export async function creditTransactionBonus(referrerId: string, referredUserId: string, referredUserName: string, escrowId: string, _isFirst: boolean): Promise<void> {
  const cfg = await getPlatformConfig();
  if (!cfg.referralTiers.firstTransactionBonusEnabled) return;
  await creditEarning(referrerId, "first_transaction", cfg.referralTiers.firstTransactionBonusAmount, referredUserId, referredUserName, escrowId);
}

export async function getReferralEarnings(userId: string): Promise<ReferralEarning[]> {
  return loadKey<ReferralEarning[]>(`refearnings:${userId}`, []);
}

export async function getMyReferrals(referrerId: string): Promise<ReferralLink[]> {
  return loadKey<ReferralLink[]>(`reflinks:${referrerId}`, []);
}

export async function getReferralConfig(): Promise<ReferralConfig> {
  return DEFAULT_REFERRAL_CONFIG;
}

export async function saveReferralConfig(_config: ReferralConfig): Promise<void> {}

export async function requestWithdrawal(userId: string, userName: string, amount: number, bankName: string, accountNumber: string, accountName: string): Promise<void> {
  const profile = await loadKey<ReferralProfile | null>(`referral:${userId}`, null);
  if (!profile || profile.pendingBalance < amount) throw new Error("Insufficient balance");
  await saveKey(`referral:${userId}`, { ...profile, pendingBalance: profile.pendingBalance - amount });
  const withdrawals = await loadKey<WithdrawalRequest[]>("ref_withdrawals", []);
  withdrawals.push({ id: newId(), userId, userName, amount, bankName, accountNumber, accountName, status: "pending", createdAt: new Date().toISOString() });
  await saveKey("ref_withdrawals", withdrawals);
}

export async function getAllWithdrawals(status?: string): Promise<WithdrawalRequest[]> {
  const all = await loadKey<WithdrawalRequest[]>("ref_withdrawals", []);
  return status ? all.filter((w) => w.status === status) : all;
}

export async function processWithdrawal(id: string, _userIdOrStatus: string, statusOrNote?: string, note?: string): Promise<void> {
  // Overloaded: (id, status, note?) or (id, userId, status, note)
  const status = (statusOrNote === "approved" || statusOrNote === "rejected") ? statusOrNote as "approved" | "rejected" : _userIdOrStatus as "approved" | "rejected";
  const resolvedNote = note ?? (statusOrNote !== "approved" && statusOrNote !== "rejected" ? statusOrNote : undefined);
  const withdrawals = await loadKey<WithdrawalRequest[]>("ref_withdrawals", []);
  const idx = withdrawals.findIndex((w) => w.id === id);
  if (idx === -1) return;
  withdrawals[idx] = { ...withdrawals[idx], status, note: resolvedNote ?? "", processedAt: new Date().toISOString() };
  await saveKey("ref_withdrawals", withdrawals);
}
