/**
 * services/subscriptions.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { uploadSubscriptionProof, uploadBoostProof } from "@/services/storage";
import { getPlatformConfig } from "@/services/platformSettings";
import { updateUserSubscription, getUserById } from "@/services/auth";
import { sendSubscriptionActivatedEmail } from "@/services/emailService";
import { addMonths } from "date-fns";
import type { SubscriptionPlan } from "@/types";

export interface SubscriptionPaymentRecord {
  id: string; userId: string; userName: string; userEmail: string;
  plan: string; planName: string; amount: number; proofUrl?: string;
  status: "pending" | "approved" | "rejected"; note?: string;
  createdAt: string; processedAt?: string; processedBy?: string;
}

export interface BoostPaymentRecord {
  id: string; userId: string; listingId: string; listingTitle: string;
  boostType: string; boostLabel: string; amount: number; proofUrl?: string;
  status: "pending" | "approved" | "rejected"; createdAt: string;
  processedAt?: string; processedBy?: string;
}

export interface PlanStatus {
  plan: SubscriptionPlan; isActive: boolean; canPost: boolean;
  activeListingCount: number; remainingSlots: number; canAccessLeads: boolean;
  hasVerifiedBadge: boolean; expiresAt?: string;
}

async function loadRecords<T>(key: string): Promise<T[]> {
  const rows = await d1Query<{ value: string }>(
    "SELECT value FROM platform_settings WHERE key = ?", [key]
  );
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as T[]; } catch { return []; }
}

async function saveRecords<T>(key: string, records: T[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [key, JSON.stringify(records), now]
  );
}

export async function submitSubscriptionPayment(params: {
  userId: string; userName: string; userEmail: string; plan: string; planName: string; amount: number; proofFile?: File;
}): Promise<void> {
  const proofUrl = params.proofFile ? await uploadSubscriptionProof(params.userId, params.proofFile) : undefined;
  const records = await loadRecords<SubscriptionPaymentRecord>("sub_payments");
  const id = newId();
  const now = new Date().toISOString();
  records.push({ id, ...params, proofUrl, status: "pending", createdAt: now });
  await saveRecords("sub_payments", records);
}

export async function submitBoostPayment(params: {
  userId: string; listingId: string; listingTitle: string; boostType: string; boostLabel: string; amount: number; proofFile?: File;
}): Promise<void> {
  const proofUrl = params.proofFile ? await uploadBoostProof(params.userId, params.proofFile) : undefined;
  const records = await loadRecords<BoostPaymentRecord>("boost_payments");
  const id = newId();
  const now = new Date().toISOString();
  records.push({ id, ...params, proofUrl, status: "pending", createdAt: now });
  await saveRecords("boost_payments", records);
}

export async function getUserPlanStatus(userId: string, userPlanSlug: string, expiryIso?: string): Promise<PlanStatus> {
  const cfg = await getPlatformConfig();
  const plan = cfg.subscriptionPlans.find((p) => p.slug === userPlanSlug) ?? cfg.subscriptionPlans[0];
  const isActive = userPlanSlug !== "free" && expiryIso ? new Date(expiryIso) > new Date() : userPlanSlug === "free";

  const activeCountRows = await d1Query<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM listings WHERE agent_id = ? AND status = 'active'", [userId]
  );
  const activeListingCount = activeCountRows[0]?.cnt ?? 0;
  const maxListings = plan.maxListings === 999999 ? Infinity : (plan.maxListings ?? 0);

  return {
    plan, isActive, canPost: activeListingCount < maxListings,
    activeListingCount, remainingSlots: maxListings === Infinity ? 999 : Math.max(0, maxListings - activeListingCount),
    canAccessLeads: (plan as unknown as { leadsAccess?: boolean }).leadsAccess === true,
    hasVerifiedBadge: userPlanSlug === "pro" || userPlanSlug === "premium",
    expiresAt: expiryIso,
  };
}

export async function getAllSubscriptionPayments(): Promise<SubscriptionPaymentRecord[]> {
  return loadRecords<SubscriptionPaymentRecord>("sub_payments");
}

export async function getAllBoostPayments(): Promise<BoostPaymentRecord[]> {
  return loadRecords<BoostPaymentRecord>("boost_payments");
}

async function updateSubPayment(paymentId: string, status: "approved" | "rejected", processedByName: string, note?: string): Promise<void> {
  const records = await loadRecords<SubscriptionPaymentRecord>("sub_payments");
  const now = new Date().toISOString();
  const idx = records.findIndex((r) => r.id === paymentId);
  if (idx === -1) return;
  records[idx] = { ...records[idx], status, processedAt: now, processedBy: processedByName, note: note ?? records[idx].note };
  await saveRecords("sub_payments", records);
}

async function updateBoostPayment(paymentId: string, status: "approved" | "rejected", processedByName: string, note?: string): Promise<void> {
  const records = await loadRecords<BoostPaymentRecord>("boost_payments");
  const now = new Date().toISOString();
  const idx = records.findIndex((r) => r.id === paymentId);
  if (idx === -1) return;
  records[idx] = { ...records[idx], status, processedAt: now, processedBy: processedByName };
  await saveRecords("boost_payments", records);
}

export async function approveSubscriptionPayment(paymentId: string, processedByName: string): Promise<void> {
  // 1. Mark payment as approved in the records
  await updateSubPayment(paymentId, "approved", processedByName);

  // 2. Find the payment record to get userId + plan
  const records = await loadRecords<SubscriptionPaymentRecord>("sub_payments");
  const payment = records.find((r) => r.id === paymentId);
  if (!payment) return;

  // 3. Activate the subscription on the user's account
  const expiry = addMonths(new Date(), 1).toISOString();
  await updateUserSubscription(payment.userId, payment.plan, expiry);

  // 4. Fire subscription activated email (fire-and-forget)
  try {
    const user = await getUserById(payment.userId);
    if (user) {
      void sendSubscriptionActivatedEmail({
        userEmail: user.email,
        userName:  user.name,
        planName:  payment.planName,
        expiresAt: new Date(expiry).toLocaleDateString("en-NG", { dateStyle: "long" }),
      });
    }
  } catch (err) {
    console.warn("[subscriptions] approveSubscriptionPayment email error:", err);
  }
}

export async function rejectSubscriptionPayment(paymentId: string, processedByName: string, note: string): Promise<void> {
  await updateSubPayment(paymentId, "rejected", processedByName, note);
}

export async function approveBoostPayment(paymentId: string, processedByName: string): Promise<void> {
  await updateBoostPayment(paymentId, "approved", processedByName);
}

export async function rejectBoostPayment(paymentId: string, processedByName: string, note?: string): Promise<void> {
  await updateBoostPayment(paymentId, "rejected", processedByName, note);
}
