"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertOctagon, BarChart2, Bell, BookmarkPlus, BookOpen, Building2,
  CheckCircle2, CreditCard, Crown, Eye, FileText, Gift, Heart,
  LayoutDashboard, LogOut, Menu, MessageSquare, PlusCircle, Search,
  Settings, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal,
  Star, Tag, Users, Wrench, Home, X, Users2, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { logoutUser } from "@/services/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ROLE_CONFIG, isLister, isAdminOrModerator } from "@/lib/roles";
import { toast } from "sonner";
import { useState as useStateAlias } from "react";
// ✅ FIX: Load plan status to conditionally show nav items
import { getUserPlanStatus } from "@/services/subscriptions";
import type { UserRole } from "@/types";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  dividerBefore?: boolean;
  planRequired?: "basic" | "pro" | "premium"; // gate nav item to plan
}

// ─── Base nav by role (plan-gated items added dynamically below) ──────────────
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  tenant: [
    { label: "Dashboard",        path: "/dashboard",               icon: LayoutDashboard },
    { label: "Browse Listings",  path: "/listings",                icon: Search },
    { label: "Saved Properties", path: "/dashboard/saved",         icon: Heart },
    { label: "Saved Searches",   path: "/dashboard/searches",      icon: BookmarkPlus },
    { label: "My Bookings",      path: "/dashboard/bookings",      icon: Building2 },
    { label: "My Offers",        path: "/dashboard/offers",        icon: Tag },
    { label: "Escrow",           path: "/dashboard/escrow",        icon: Shield },
    { label: "Messages",         path: "/messages",                icon: MessageSquare },
    { label: "Notifications",    path: "/dashboard/notifications", icon: Bell },
    { label: "Subscription",     path: "/dashboard/subscription",  icon: CreditCard, dividerBefore: true },
    { label: "Referral",         path: "/dashboard/referral",      icon: Gift },
    { label: "Profile",          path: "/dashboard/profile",       icon: Settings, dividerBefore: true },
    { label: "Settings",         path: "/dashboard/settings",      icon: SlidersHorizontal },
  ],
  agent: [
    { label: "Dashboard",      path: "/dashboard",               icon: LayoutDashboard },
    { label: "My Listings",    path: "/dashboard/listings",      icon: Building2 },
    { label: "Create Listing", path: "/dashboard/listings/new",  icon: PlusCircle },
    { label: "Boost Listing",  path: "/dashboard/boost",         icon: Tag },
    { label: "Flash Deals",    path: "/dashboard/flash-deals",   icon: Zap },
    // ✅ Analytics — shown for all but gated inside the page by plan
    { label: "Analytics",      path: "/dashboard/analytics",     icon: BarChart2 },
    // ✅ Leads — shown only for Pro/Premium (added dynamically)
    { label: "Tenant Leads",   path: "/dashboard/leads",         icon: Users2,      planRequired: "pro" },
    { label: "Offers Received", path: "/dashboard/offers",       icon: Tag },
    { label: "Escrow Deals",   path: "/dashboard/escrow",        icon: Shield,      dividerBefore: true },
    { label: "Messages",       path: "/messages",                icon: MessageSquare },
    { label: "Notifications",  path: "/dashboard/notifications", icon: Bell },
    { label: "Subscription",   path: "/dashboard/subscription",  icon: CreditCard,  dividerBefore: true },
    { label: "Referral",       path: "/dashboard/referral",      icon: Gift },
    { label: "Get Verified",   path: "/dashboard/verification",  icon: CheckCircle2 },
    { label: "Profile",        path: "/dashboard/profile",       icon: Settings,    dividerBefore: true },
    { label: "Settings",       path: "/dashboard/settings",      icon: SlidersHorizontal },
  ],
  landlord: [
    { label: "Dashboard",      path: "/dashboard",               icon: LayoutDashboard },
    { label: "My Properties",  path: "/dashboard/listings",      icon: Home },
    { label: "Add Property",   path: "/dashboard/listings/new",  icon: PlusCircle },
    { label: "Boost Listing",  path: "/dashboard/boost",         icon: Tag },
    { label: "Flash Deals",    path: "/dashboard/flash-deals",   icon: Zap },
    { label: "Analytics",      path: "/dashboard/analytics",     icon: BarChart2 },
    { label: "Tenant Leads",   path: "/dashboard/leads",         icon: Users2,      planRequired: "pro" },
    { label: "Offers Received", path: "/dashboard/offers",       icon: Tag },
    { label: "Escrow Deals",   path: "/dashboard/escrow",        icon: Shield,      dividerBefore: true },
    { label: "Messages",       path: "/messages",                icon: MessageSquare },
    { label: "Notifications",  path: "/dashboard/notifications", icon: Bell },
    { label: "Subscription",   path: "/dashboard/subscription",  icon: CreditCard,  dividerBefore: true },
    { label: "Referral",       path: "/dashboard/referral",      icon: Gift },
    { label: "Get Verified",   path: "/dashboard/verification",  icon: CheckCircle2 },
    { label: "Profile",        path: "/dashboard/profile",       icon: Settings,    dividerBefore: true },
    { label: "Settings",       path: "/dashboard/settings",      icon: SlidersHorizontal },
  ],
  seller: [
    { label: "Dashboard",      path: "/dashboard",               icon: LayoutDashboard },
    { label: "My Listings",    path: "/dashboard/listings",      icon: Tag },
    { label: "Add Listing",    path: "/dashboard/listings/new",  icon: PlusCircle },
    { label: "Boost Listing",  path: "/dashboard/boost",         icon: Star },
    { label: "Flash Deals",    path: "/dashboard/flash-deals",   icon: Zap },
    { label: "Analytics",      path: "/dashboard/analytics",     icon: BarChart2 },
    { label: "Offers Received", path: "/dashboard/offers",       icon: Tag },
    { label: "Escrow Deals",   path: "/dashboard/escrow",        icon: Shield,      dividerBefore: true },
    { label: "Messages",       path: "/messages",                icon: MessageSquare },
    { label: "Notifications",  path: "/dashboard/notifications", icon: Bell },
    { label: "Subscription",   path: "/dashboard/subscription",  icon: CreditCard,  dividerBefore: true },
    { label: "Referral",       path: "/dashboard/referral",      icon: Gift },
    { label: "Get Verified",   path: "/dashboard/verification",  icon: CheckCircle2 },
    { label: "Profile",        path: "/dashboard/profile",       icon: Settings,    dividerBefore: true },
    { label: "Settings",       path: "/dashboard/settings",      icon: SlidersHorizontal },
  ],
  service_provider: [
    { label: "Dashboard",      path: "/dashboard",               icon: LayoutDashboard },
    { label: "My Services",    path: "/dashboard/listings",      icon: Wrench },
    { label: "Add Service",    path: "/dashboard/listings/new",  icon: PlusCircle },
    { label: "Boost Service",  path: "/dashboard/boost",         icon: Star },
    { label: "Flash Deals",    path: "/dashboard/flash-deals",   icon: Zap },
    { label: "Analytics",      path: "/dashboard/analytics",     icon: BarChart2 },
    { label: "Offers Received", path: "/dashboard/offers",       icon: Tag },
    { label: "Escrow Deals",   path: "/dashboard/escrow",        icon: Shield,      dividerBefore: true },
    { label: "Messages",       path: "/messages",                icon: MessageSquare },
    { label: "Notifications",  path: "/dashboard/notifications", icon: Bell },
    { label: "Subscription",   path: "/dashboard/subscription",  icon: CreditCard,  dividerBefore: true },
    { label: "Referral",       path: "/dashboard/referral",      icon: Gift },
    { label: "Get Verified",   path: "/dashboard/verification",  icon: CheckCircle2 },
    { label: "Profile",        path: "/dashboard/profile",       icon: Settings,    dividerBefore: true },
    { label: "Settings",       path: "/dashboard/settings",      icon: SlidersHorizontal },
  ],
  moderator: [
    { label: "Overview",          path: "/admin",                   icon: LayoutDashboard },
    { label: "Review Listings",   path: "/admin/listings",          icon: Eye },
    { label: "Verifications",     path: "/admin/verifications",     icon: CheckCircle2 },
    { label: "Disputes",          path: "/admin/disputes",          icon: AlertOctagon },
    { label: "Escrows",           path: "/admin/escrows",           icon: Shield },
    { label: "Reports",           path: "/admin/reports",           icon: ShieldAlert, dividerBefore: true },
    { label: "Subscriptions",     path: "/admin/subscriptions",     icon: CreditCard },
    { label: "Referrals",         path: "/admin/referrals",         icon: Gift },
    { label: "Blog",              path: "/admin/blog",              icon: BookOpen },
    { label: "Content",           path: "/admin/content",           icon: FileText },
    { label: "Messages",          path: "/admin/messages",          icon: MessageSquare, dividerBefore: true },
    { label: "Notifications",     path: "/dashboard/notifications", icon: Bell },
    { label: "Profile",           path: "/dashboard/profile",       icon: Settings,    dividerBefore: true },
    { label: "Settings",          path: "/dashboard/settings",      icon: SlidersHorizontal },
  ],
  admin: [
    { label: "Overview",          path: "/admin",                   icon: LayoutDashboard },
    { label: "Users",             path: "/admin/users",             icon: Users },
    { label: "Listings",          path: "/admin/listings",          icon: Building2 },
    { label: "Verifications",     path: "/admin/verifications",     icon: CheckCircle2 },
    { label: "Escrows",           path: "/admin/escrows",           icon: Shield },
    { label: "Disputes",          path: "/admin/disputes",          icon: AlertOctagon },
    { label: "Messages",          path: "/admin/messages",          icon: MessageSquare },
    { label: "Reports",           path: "/admin/reports",           icon: ShieldAlert, dividerBefore: true },
    { label: "Subscriptions",     path: "/admin/subscriptions",     icon: CreditCard },
    { label: "Boost Payments",    path: "/admin/boosts",            icon: Tag },
    { label: "Referrals",         path: "/admin/referrals",         icon: Gift },
    { label: "Blog",              path: "/admin/blog",              icon: BookOpen },
    { label: "Content",           path: "/admin/content",           icon: FileText },
    { label: "Post a Listing",    path: "/dashboard/listings/new", icon: PlusCircle,        dividerBefore: true },
    { label: "Platform Settings", path: "/admin/settings",          icon: SlidersHorizontal },
    { label: "Revenue",           path: "/admin/revenue",           icon: BarChart2 },
    { label: "Notifications",     path: "/dashboard/notifications", icon: Bell },
    { label: "Profile",           path: "/dashboard/profile",       icon: Settings,    dividerBefore: true },
    { label: "Settings",          path: "/dashboard/settings",      icon: SlidersHorizontal },
  ],
};

// Plan label + color
const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  free:    { label: "Free",    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  basic:   { label: "Basic",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  pro:     { label: "Pro",     color: "bg-primary/10 text-primary" },
  premium: { label: "Premium", color: "bg-accent/20 text-accent-foreground" },
};

// Plan hierarchy for gating
const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2, premium: 3 };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // ✅ Plan status for nav gating
  const [canAccessLeads, setCanAccessLeads] = useState(false);
  const [hasVerifiedBadge, setHasVerifiedBadge] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserPlanStatus(user.id, user.subscriptionPlan ?? "free", user.subscriptionExpiry)
      .then((status) => {
        setCanAccessLeads(status.canAccessLeads);
        setHasVerifiedBadge(status.hasVerifiedBadge);
        setPlanLoaded(true);
      })
      .catch(() => setPlanLoaded(true));
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

  const role = user.role ?? "tenant";
  const baseNavItems = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.tenant;
  const currentPlanSlug = user.subscriptionPlan ?? "free";
  const currentPlanRank = PLAN_RANK[currentPlanSlug] ?? 0;
  const planBadge = PLAN_BADGE[currentPlanSlug] ?? PLAN_BADGE.free;

  // ✅ Filter nav items by plan — planRequired means minimum plan needed
  const navItems = baseNavItems.filter((item) => {
    if (!item.planRequired) return true;
    const required = PLAN_RANK[item.planRequired] ?? 0;
    return currentPlanRank >= required;
  });

  const roleCfg = ROLE_CONFIG[role];
  const isStaffRole = isAdminOrModerator(role);

  const handleLogout = async () => {
    try {
      await logoutUser();
      logout();
      router.push("/");
      toast.success("Signed out successfully");
    } catch {
      toast.error("Sign out failed");
    }
  };

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <Link
        href="/"
        onClick={() => setMobileSidebarOpen(false)}
        className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border hover:opacity-80 transition-opacity"
      >
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-accent-foreground" />
        </div>
        <span className="text-lg font-serif font-semibold text-sidebar-foreground">
          Homvera<span className="text-accent font-bold">X</span>
        </span>
        {isStaffRole && (
          <span className={cn(
            "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded",
            role === "admin" ? "bg-red-500/20 text-red-400" : "bg-indigo-500/20 text-indigo-400"
          )}>
            {role === "admin" ? "ADMIN" : "MOD"}
          </span>
        )}
      </Link>

      {/* User info + plan badge */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-sidebar-border">
            <AvatarImage src={user.avatarUrl} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</p>
              {/* ✅ Verified badge — only shown when plan grants verifiedBadge */}
              {hasVerifiedBadge && user.verificationStatus === "approved" && (
                <span title="Verified agent" className="inline-flex shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn(
                "inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded",
                roleCfg.bgColor, roleCfg.color
              )}>
                {roleCfg.shortLabel}
              </span>
              {/* ✅ Plan badge in sidebar */}
              {!isStaffRole && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                  planBadge.color
                )}>
                  {currentPlanSlug === "premium" && <Crown className="w-2.5 h-2.5" />}
                  {planBadge.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active =
            pathname === item.path ||
            (!["/dashboard", "/admin"].includes(item.path) && pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <div key={item.path}>
              {item.dividerBefore && (
                <div className="my-2 border-t border-sidebar-border" />
              )}
              <Link
                href={item.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* ✅ Upgrade upsell — shown to free/basic users who are listers */}
      {isLister(role) && !isStaffRole && currentPlanSlug === "free" && (
        <div className="mx-3 mb-2">
          <Link href="/dashboard/subscription">
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 hover:bg-primary/20 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-0.5">
                <Crown className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-primary">Upgrade Plan</span>
              </div>
              <p className="text-[11px] text-primary/70">Unlock leads, analytics & more</p>
            </div>
          </Link>
        </div>
      )}

      {/* Pro upsell for basic users */}
      {isLister(role) && !isStaffRole && currentPlanSlug === "basic" && (
        <div className="mx-3 mb-2">
          <Link href="/dashboard/subscription">
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 hover:bg-primary/20 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-0.5">
                <Crown className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-primary">Upgrade to Pro</span>
              </div>
              <p className="text-[11px] text-primary/70">Get tenant leads & 2× ranking</p>
            </div>
          </Link>
        </div>
      )}

      {/* Verified upsell */}
      {isLister(role) && user.verificationStatus !== "approved" && (
        <div className="mx-3 mb-2">
          <Link href="/dashboard/verification">
            <div className="rounded-xl bg-accent/20 p-3 hover:bg-accent/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-foreground" />
                <span className="text-xs font-bold text-accent-foreground">Get Verified</span>
              </div>
              <p className="text-[11px] text-accent-foreground/70">Build trust with clients</p>
            </div>
          </Link>
        </div>
      )}

      {/* Switch role hint */}
      {!isStaffRole && (
        <div className="mx-3 mb-2">
          <Link href="/dashboard/profile#role">
            <div className="rounded-xl bg-sidebar-accent/40 px-3 py-2 hover:bg-sidebar-accent transition-colors cursor-pointer flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/50">Switch role</span>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", roleCfg.bgColor, roleCfg.color)}>
                {roleCfg.shortLabel}
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Logout */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-destructive transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-[var(--sidebar)] fixed h-full z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-72 bg-[var(--sidebar)] h-full flex flex-col shadow-2xl">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-64">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background border-b border-border">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <span className="text-base font-serif font-semibold text-foreground">
            Homvera<span className="text-accent font-bold">X</span>
          </span>
          <Link href="/dashboard/notifications" className="p-2 rounded-xl hover:bg-secondary">
            <Bell className="w-5 h-5 text-foreground" />
          </Link>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
