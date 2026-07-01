"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, Users, Building2, Shield, DollarSign,
  ArrowUpRight, ArrowDownRight, RefreshCw, Wallet,
  Clock, CheckCircle2, AlertCircle, Gift,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { getAdminRevenueStats } from "@/services/adminStats";
import type { RevenueStats } from "@/services/adminStats";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, trend, color = "primary",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  color?: "primary" | "green" | "yellow" | "red" | "blue";
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    green:   "bg-green-100 text-green-600",
    yellow:  "bg-yellow-100 text-yellow-600",
    red:     "bg-red-100 text-red-600",
    blue:    "bg-blue-100 text-blue-600",
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={cn("flex items-center gap-0.5 text-xs font-semibold",
            trend.value >= 0 ? "text-green-600" : "text-red-500"
          )}>
            {trend.value >= 0
              ? <ArrowUpRight className="w-3 h-3" />
              : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend.value)}% {trend.label}
          </div>
        )}
      </div>
      <p className="text-2xl font-serif font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminRevenueClient() {
  const [stats, setStats]           = useState<RevenueStats | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAdminRevenueStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error("Failed to load revenue data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Revenue Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Platform performance overview
            {lastUpdated && (
              <span className="ml-2 text-xs">· Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(16)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : stats ? (
        <div className="space-y-6">

          {/* Revenue */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              💰 Revenue
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Platform Revenue"
                value={formatCurrency(stats.totalRevenue)}
                subtitle="Buyer charge + seller fee"
                icon={DollarSign} color="green"
              />
              <StatCard
                title="Monthly Revenue"
                value={formatCurrency(stats.monthlyRevenue)}
                subtitle="Last 30 days"
                icon={TrendingUp} color="green"
              />
              <StatCard
                title="Weekly Revenue"
                value={formatCurrency(stats.weeklyRevenue)}
                subtitle="Last 7 days"
                icon={TrendingUp} color="blue"
              />
              <StatCard
                title="Total Escrow Volume"
                value={formatCurrency(stats.totalEscrowVolume)}
                subtitle="All completed deals"
                icon={Shield} color="primary"
              />
            </div>

            {/* Revenue breakdown card */}
            <div className="mt-4 bg-card border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Revenue Breakdown</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Buyer Service Charge ({stats.buyerServiceChargePercent}%)
                  </p>
                  <p className="text-xl font-serif font-bold text-blue-700 dark:text-blue-300">
                    {formatCurrency(stats.buyerServiceChargeRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Collected from buyers at checkout</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Seller Platform Fee (up to {stats.platformFeePercent}%)
                  </p>
                  <p className="text-xl font-serif font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(stats.sellerPlatformFeeRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Deducted from seller payouts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Escrow */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              🔒 Escrow
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Active Escrow Value"
                value={formatCurrency(stats.activeEscrowValue)}
                subtitle={`${stats.pendingEscrows} deals in progress`}
                icon={Clock} color="yellow"
              />
              <StatCard
                title="Completed Deals"
                value={stats.completedEscrows.toString()}
                subtitle="Successfully released"
                icon={CheckCircle2} color="green"
              />
              <StatCard
                title="Disputed Deals"
                value={stats.disputedEscrows.toString()}
                subtitle="Needs attention"
                icon={AlertCircle} color="red"
              />
              <StatCard
                title="Total Escrows"
                value={stats.totalEscrows.toString()}
                subtitle="All time"
                icon={Shield} color="primary"
              />
            </div>
          </div>

          {/* Users */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              👥 Users
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Users"        value={stats.totalUsers.toString()}             icon={Users} color="primary" />
              <StatCard title="New This Month"     value={stats.newUsersThisMonth.toString()}      subtitle="Last 30 days" icon={Users} color="green" />
              <StatCard title="New This Week"      value={stats.newUsersThisWeek.toString()}       subtitle="Last 7 days"  icon={Users} color="blue" />
              <StatCard title="Pending Verifications" value={stats.pendingVerifications.toString()} subtitle="Awaiting review" icon={AlertCircle} color="yellow" />
            </div>
          </div>

          {/* Listings */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              🏠 Listings
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Listings"    value={stats.totalListings.toString()}       icon={Building2} color="primary" />
              <StatCard title="Active Listings"   value={stats.activeListings.toString()}      subtitle="Live on platform"  icon={Building2} color="green" />
              <StatCard title="New This Month"    value={stats.newListingsThisMonth.toString()} subtitle="Last 30 days"    icon={Building2} color="blue" />
              <StatCard title="Pending Subscriptions" value={stats.pendingSubscriptions.toString()} subtitle="Awaiting activation" icon={AlertCircle} color="yellow" />
            </div>
          </div>

          {/* Payouts & withdrawals */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              💸 Payouts & Withdrawals
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Pending Seller Payouts"
                value={stats.pendingPayouts.toString()}
                subtitle="Awaiting approval"
                icon={Wallet} color="yellow"
              />
              <StatCard
                title="Pending Payout Value"
                value={formatCurrency(stats.pendingPayoutValue)}
                subtitle="Total requested"
                icon={Wallet} color="red"
              />
              <StatCard
                title="Referral Withdrawals"
                value={stats.pendingReferralWithdrawals.toString()}
                subtitle="Awaiting processing"
                icon={Gift} color="yellow"
              />
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Actions Needed</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Review Verifications",    count: stats.pendingVerifications,        href: "/admin/verifications" },
                { label: "Process Payouts",         count: stats.pendingPayouts,               href: "/admin/payouts" },
                { label: "Referral Withdrawals",    count: stats.pendingReferralWithdrawals,   href: "/admin/referrals" },
                { label: "Activate Subscriptions",  count: stats.pendingSubscriptions,         href: "/admin/subscriptions" },
                { label: "Resolve Disputes",        count: stats.disputedEscrows,              href: "/admin/escrows" },
              ].map(({ label, count, href }) => (
                <a key={href} href={href}
                  className={cn(
                    "rounded-xl p-3 text-center transition-all hover:scale-105",
                    count > 0 ? "bg-red-50 border border-red-200" : "bg-secondary border border-border",
                  )}>
                  <p className={cn("text-2xl font-bold", count > 0 ? "text-red-600" : "text-muted-foreground")}>
                    {count}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </a>
              ))}
            </div>
          </div>

        </div>
      ) : null}
    </DashboardLayout>
  );
}
