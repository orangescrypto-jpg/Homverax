/**
 * services/adminStats.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */

import { d1Query } from "@/lib/d1";
import { getPlatformConfig } from "@/services/platformSettings";

export interface RevenueStats {
  totalRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  totalEscrowVolume: number;
  activeEscrowValue: number;
  releasedEscrowValue: number;
  buyerServiceChargeRevenue: number;
  sellerPlatformFeeRevenue: number;
  platformFeePercent: number;
  buyerServiceChargePercent: number;
  totalUsers: number;
  newUsersThisMonth: number;
  newUsersThisWeek: number;
  totalListings: number;
  activeListings: number;
  newListingsThisMonth: number;
  totalEscrows: number;
  pendingEscrows: number;
  completedEscrows: number;
  disputedEscrows: number;
  pendingVerifications: number;
  pendingPayouts: number;
  pendingPayoutValue: number;
  pendingSubscriptions: number;
  pendingReferralWithdrawals: number;
}

interface CountRow { cnt: number; }
interface SumRow { total: number | null; }

export async function getAdminRevenueStats(): Promise<RevenueStats> {
  const cfg = await getPlatformConfig();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const weekAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsersR, newUsersMonthR, newUsersWeekR,
    totalListingsR, activeListingsR, newListingsMonthR,
    totalEscrowsR, pendingEscrowsR, completedEscrowsR, disputedEscrowsR,
    escrowVolumeR, activeEscrowValueR,
    totalRevR, monthlyRevR, weeklyRevR,
    buyerRevR, sellerRevR,
    pendingVerifR, pendingPayoutsR, pendingPayoutValR,
  ] = await Promise.all([
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM users", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM users WHERE created_at >= ?", [monthAgo]),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM users WHERE created_at >= ?", [weekAgo]),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM listings", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM listings WHERE status = 'active'", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM listings WHERE created_at >= ?", [monthAgo]),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM escrows", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM escrows WHERE status IN ('funded','held','inspection')", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM escrows WHERE status = 'released'", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM escrows WHERE status = 'disputed'", []),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount),0) as total FROM escrows WHERE status = 'released'", []),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount),0) as total FROM escrows WHERE status IN ('funded','held','inspection')", []),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount * ? / 100),0) as total FROM escrows WHERE status = 'released'", [cfg.escrowFees.sellerSaleFeePercent + cfg.escrowFees.buyerServiceChargePercent]),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount * ? / 100),0) as total FROM escrows WHERE status = 'released' AND updated_at >= ?", [cfg.escrowFees.sellerSaleFeePercent + cfg.escrowFees.buyerServiceChargePercent, monthAgo]),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount * ? / 100),0) as total FROM escrows WHERE status = 'released' AND updated_at >= ?", [cfg.escrowFees.sellerSaleFeePercent + cfg.escrowFees.buyerServiceChargePercent, weekAgo]),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount * ? / 100),0) as total FROM escrows WHERE status = 'released'", [cfg.escrowFees.buyerServiceChargePercent]),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount * ? / 100),0) as total FROM escrows WHERE status = 'released'", [cfg.escrowFees.sellerSaleFeePercent]),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM wallet_transactions WHERE type = 'payout' AND description LIKE '%pending%'", []),
    d1Query<CountRow>("SELECT COUNT(*) as cnt FROM wallet_transactions WHERE type = 'payout'", []),
    d1Query<SumRow>("SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE type = 'payout'", []),
  ]);

  return {
    totalRevenue: totalRevR[0]?.total ?? 0,
    monthlyRevenue: monthlyRevR[0]?.total ?? 0,
    weeklyRevenue: weeklyRevR[0]?.total ?? 0,
    totalEscrowVolume: escrowVolumeR[0]?.total ?? 0,
    activeEscrowValue: activeEscrowValueR[0]?.total ?? 0,
    releasedEscrowValue: escrowVolumeR[0]?.total ?? 0,
    buyerServiceChargeRevenue: buyerRevR[0]?.total ?? 0,
    sellerPlatformFeeRevenue: sellerRevR[0]?.total ?? 0,
    platformFeePercent: cfg.escrowFees.sellerSaleFeePercent,
    buyerServiceChargePercent: cfg.escrowFees.buyerServiceChargePercent,
    totalUsers: totalUsersR[0]?.cnt ?? 0,
    newUsersThisMonth: newUsersMonthR[0]?.cnt ?? 0,
    newUsersThisWeek: newUsersWeekR[0]?.cnt ?? 0,
    totalListings: totalListingsR[0]?.cnt ?? 0,
    activeListings: activeListingsR[0]?.cnt ?? 0,
    newListingsThisMonth: newListingsMonthR[0]?.cnt ?? 0,
    totalEscrows: totalEscrowsR[0]?.cnt ?? 0,
    pendingEscrows: pendingEscrowsR[0]?.cnt ?? 0,
    completedEscrows: completedEscrowsR[0]?.cnt ?? 0,
    disputedEscrows: disputedEscrowsR[0]?.cnt ?? 0,
    pendingVerifications: pendingVerifR[0]?.cnt ?? 0,
    pendingPayouts: pendingPayoutsR[0]?.cnt ?? 0,
    pendingPayoutValue: pendingPayoutValR[0]?.total ?? 0,
    pendingSubscriptions: 0,
    pendingReferralWithdrawals: 0,
  };
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeListings: number;
  totalListings: number;
  pendingVerifications: number;
  escrowHeld: number;
  totalRevenue: number;
  pendingPayouts: number;
  completedEscrows: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const stats = await getAdminRevenueStats();
  return {
    totalUsers: stats.totalUsers,
    activeListings: stats.activeListings,
    totalListings: stats.totalListings,
    pendingVerifications: stats.pendingVerifications,
    escrowHeld: stats.activeEscrowValue,
    totalRevenue: stats.totalRevenue,
    pendingPayouts: stats.pendingPayouts,
    completedEscrows: stats.completedEscrows,
  };
}
