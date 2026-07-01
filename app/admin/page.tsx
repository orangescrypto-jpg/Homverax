"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Building2, DollarSign,
  Shield, Users, AlertCircle, TrendingUp, PlusCircle,
  FileText, CreditCard, Gift, BarChart2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { getAllEscrows } from "@/services/escrow";
import { getAdminDashboardStats } from "@/services/adminStats";
import { getPendingVerifications } from "@/services/verification";
import type { EscrowTransaction, VerificationRequest } from "@/types";

interface AdminStats {
  totalUsers: number;
  activeListings: number;
  totalListings: number;
  pendingVerifications: number;
  escrowHeld: number;
  totalRevenue: number;
  pendingPayouts: number;
  completedEscrows: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeListings: 0,
    totalListings: 0,
    pendingVerifications: 0,
    escrowHeld: 0,
    totalRevenue: 0,
    pendingPayouts: 0,
    completedEscrows: 0,
  });
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") return;

    async function load() {
      try {
        // ── All stats fetched through service layer ────────────────────────
        const dashStats = await getAdminDashboardStats();
        setStats(dashStats);
      } catch (err) {
        console.error("Admin stats error:", err);
        toast.error("Failed to load some stats");
      }

      // ── Recent escrows + verifications (separate try so stats still show) ─
      try {
        const [e, v] = await Promise.all([
          getAllEscrows(),
          getPendingVerifications(),
        ]);
        setEscrows(e.slice(0, 5));
        setVerifications(v.slice(0, 5));
      } catch {
        // non-critical — lists just stay empty
      }

      setIsLoading(false);
    }

    load();
  }, [user]);

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <AlertCircle className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h2 className="text-xl font-serif font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-2 text-sm">You don't have admin privileges.</p>
        </div>
      </DashboardLayout>
    );
  }

  const STAT_CARDS = [
    { icon: Users,      label: "Total Users",           value: stats.totalUsers.toLocaleString(),       color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/40" },
    { icon: Building2,  label: "Active Listings",       value: stats.activeListings.toLocaleString(),   color: "text-green-500",   bg: "bg-green-50 dark:bg-green-950/40" },
    { icon: Shield,     label: "Escrow Held",           value: formatCurrency(stats.escrowHeld),        color: "text-primary",     bg: "bg-primary/10" },
    { icon: BadgeCheck, label: "Pending Verifications", value: stats.pendingVerifications.toString(),   color: "text-yellow-600",  bg: "bg-yellow-50 dark:bg-yellow-950/40" },
    { icon: DollarSign, label: "Total Revenue",         value: formatCurrency(stats.totalRevenue),      color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    { icon: TrendingUp, label: "Total Listings",        value: stats.totalListings.toLocaleString(),    color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-950/40" },
    { icon: FileText,   label: "Pending Payouts",       value: stats.pendingPayouts.toString(),         color: "text-orange-500",  bg: "bg-orange-50 dark:bg-orange-950/40" },
    { icon: BarChart2,  label: "Completed Escrows",     value: stats.completedEscrows.toString(),       color: "text-cyan-600",    bg: "bg-cyan-50 dark:bg-cyan-950/40" },
  ];

  const QUICK_LINKS = [
    { href: "/admin/users",            label: "Manage Users",      icon: Users },
    { href: "/admin/listings",         label: "Manage Listings",   icon: Building2 },
    { href: "/admin/escrows",          label: "All Escrows",       icon: Shield },
    { href: "/admin/verifications",    label: "Verifications",     icon: BadgeCheck },
    { href: "/admin/payouts",          label: "Payouts",           icon: DollarSign },
    { href: "/admin/subscriptions",    label: "Subscriptions",     icon: CreditCard },
    { href: "/admin/referrals",        label: "Referrals",         icon: Gift },
    { href: "/admin/settings",         label: "Platform Settings", icon: Shield },
    { href: "/dashboard/listings/new", label: "Post a Listing",    icon: PlusCircle },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading
          ? [...Array(8)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)
          : STAT_CARDS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
                  <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-serif font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              );
            })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Button variant="outline" className="w-full gap-2 h-11 justify-start">
                <Icon className="w-4 h-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent escrows */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Escrows</h2>
            <Link href="/admin/escrows" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : escrows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No escrow transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {escrows.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.listingTitle}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{formatCurrency(e.amount)}</p>
                    <span className="text-xs text-muted-foreground capitalize">{e.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending verifications */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Pending Verifications</h2>
            <Link href="/admin/verifications" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : verifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending verifications.</p>
          ) : (
            <div className="space-y-3">
              {verifications.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{v.userName}</p>
                    <p className="text-xs text-muted-foreground">{v.userEmail} · {v.type}</p>
                  </div>
                  <Link href="/admin/verifications">
                    <Button size="sm" variant="outline" className="text-xs h-7">Review</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
