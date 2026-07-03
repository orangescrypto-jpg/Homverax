"use client";

/**
 * AgentDashboard — for role: agent | landlord
 *
 * Sections:
 *  1. Welcome + verification banner
 *  2. Stats: Active listings / Total views / Wallet balance / Active escrows
 *  3. Plan usage bar (listing slots)
 *  4. Quick actions
 *  5. Recent listings (with status + views)
 *  6. Pending bookings/viewings to confirm
 *  7. Active escrow deals
 *  8. Recent wallet transactions
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, BarChart2, Building2, CheckCircle2,
  Clock, Crown, Eye, Loader2, MapPin, MessageSquare, PlusCircle,
  Shield, Star, Tag, TrendingUp, Wallet, X, AlertCircle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getMyListings } from "@/services/listings";
import { getMyEscrows } from "@/services/escrow";
import { getOrCreateWallet, getWalletTransactions } from "@/services/wallet";
import { getMyBookings } from "@/services/bookings";
import { getMyConversations } from "@/services/messages";
import { getUserPlanStatus } from "@/services/subscriptions";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import type { PropertyListing, EscrowTransaction, Booking } from "@/types";
import type { SellerWallet, WalletTransaction } from "@/services/wallet";
import type { Conversation } from "@/types";
import type { PlanStatus } from "@/services/subscriptions";

const ESCROW_COLOR: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  funded:     "bg-blue-100 text-blue-700",
  held:       "bg-indigo-100 text-indigo-700",
  inspection: "bg-purple-100 text-purple-700",
  released:   "bg-green-100 text-green-700",
  disputed:   "bg-red-100 text-red-700",
};

const STATUS_DOT: Record<string, string> = {
  active:  "bg-green-500",
  draft:   "bg-gray-400",
  paused:  "bg-yellow-500",
  sold:    "bg-blue-500",
};

function StatCard({
  label, value, sub, icon: Icon, color = "text-primary", href,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; href?: string;
}) {
  const inner = (
    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-serif font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function AgentDashboard() {
  const { user } = useAuth();

  const [listings, setListings]           = useState<PropertyListing[]>([]);
  const [escrows, setEscrows]             = useState<EscrowTransaction[]>([]);
  const [bookings, setBookings]           = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [wallet, setWallet]               = useState<SellerWallet | null>(null);
  const [walletTxns, setWalletTxns]       = useState<WalletTransaction[]>([]);
  const [planStatus, setPlanStatus]       = useState<PlanStatus | null>(null);
  const [isLoading, setIsLoading]         = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyListings(user.id),
      getMyEscrows(user.id),
      getMyBookings(user.id),
      getMyConversations(user.id),
      getOrCreateWallet(user.id),
      getWalletTransactions(user.id, 5),
      getUserPlanStatus(user.id, user.subscriptionPlan ?? "free", user.subscriptionExpiry),
    ])
      .then(([l, e, b, c, w, wt, ps]) => {
        setListings(l);
        setEscrows(e);
        setBookings(b);
        setConversations(c);
        setWallet(w);
        setWalletTxns(wt);
        setPlanStatus(ps);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [user]);

  const role = user?.role ?? "agent";
  const isLandlord = role === "landlord";

  const activeListings   = listings.filter((l) => l.status === "active");
  const totalViews       = listings.reduce((s, l) => s + (l.viewsCount ?? 0), 0);
  const activeEscrows    = escrows.filter((e) => !["released", "refunded", "resolved", "cancelled"].includes(e.status));
  const pendingBookings  = bookings.filter((b) => b.sellerId === user?.id && b.status === "pending");
  const unreadMsgs       = conversations.reduce((s, c) => s + (c.unreadFor === user?.id ? c.unreadCount : 0), 0);
  const maxListings      = planStatus ? (planStatus.plan.maxListings === 999999 ? Infinity : planStatus.plan.maxListings) : 3;
  const slotsUsed        = activeListings.length;
  const slotsTotal       = maxListings === Infinity ? null : maxListings;
  const slotsPct         = slotsTotal ? Math.min(100, (slotsUsed / slotsTotal) * 100) : 0;

  return (
    <DashboardLayout>
      {/* ── Welcome ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            Welcome back, {user?.firstName || user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLandlord ? "Your property portfolio" : "Your listings and deals"} at a glance.
          </p>
        </div>
        <Link href="/dashboard/listings/new">
          <Button className="gap-2 shrink-0">
            <PlusCircle className="w-4 h-4" />
            {isLandlord ? "Add Property" : "New Listing"}
          </Button>
        </Link>
      </div>

      {/* ── Verification banner ──────────────────────────────────────────── */}
      {user?.verificationStatus !== "approved" && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {user?.verificationStatus === "pending" ? "Verification in progress" : "Get verified to build trust"}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {user?.verificationStatus === "pending"
                  ? "We're reviewing your documents — 1–2 business days."
                  : "Verified agents get 3× more enquiries and a trusted badge."}
              </p>
            </div>
          </div>
          {user?.verificationStatus !== "pending" && (
            <Link href="/dashboard/verification">
              <Button size="sm" className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white">Get Verified</Button>
            </Link>
          )}
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Active Listings" value={activeListings.length}
            sub={`${listings.length} total`} icon={Building2} href="/dashboard/listings" />
          <StatCard label="Total Views" value={totalViews.toLocaleString()}
            sub="Across all listings" icon={Eye} color="text-blue-500" href="/dashboard/analytics" />
          <StatCard label="Wallet Balance" value={wallet ? formatCurrency(wallet.balance) : "₦0"}
            sub={wallet?.pendingBalance ? `+ ${formatCurrency(wallet.pendingBalance)} pending` : "Available to withdraw"}
            icon={Wallet} color="text-green-500" href="/dashboard/wallet" />
          <StatCard label="Active Escrows" value={activeEscrows.length}
            sub={activeEscrows.length > 0 ? formatCurrency(activeEscrows.reduce((s, e) => s + e.amount, 0)) : "No active deals"}
            icon={Shield} color="text-purple-500" href="/dashboard/escrow" />
          <StatCard label="Messages" value={unreadMsgs > 0 ? `${unreadMsgs} unread` : conversations.length}
            sub={unreadMsgs > 0 ? "Needs a reply" : conversations.length > 0 ? "All caught up" : "No conversations yet"}
            icon={MessageSquare} color="text-amber-500" href="/messages" />
        </div>
      )}

      {/* ── Plan usage bar ────────────────────────────────────────────────── */}
      {planStatus && slotsTotal && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground capitalize">{planStatus.plan.name} Plan</span>
              {planStatus.plan.slug === "free" && (
                <span className="text-xs text-muted-foreground">· Upgrade for more slots</span>
              )}
            </div>
            <span className="text-sm font-bold text-foreground">{slotsUsed} / {slotsTotal} listings</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all",
              slotsPct >= 100 ? "bg-red-500" : slotsPct >= 80 ? "bg-amber-500" : "bg-primary"
            )} style={{ width: `${slotsPct}%` }} />
          </div>
          {slotsPct >= 100 ? (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Listing limit reached
              </p>
              <Link href="/dashboard/subscription" className="text-xs text-primary font-semibold hover:underline">Upgrade →</Link>
            </div>
          ) : slotsPct >= 80 ? (
            <p className="text-xs text-amber-600 mt-1.5">
              {slotsTotal - slotsUsed} slot{slotsTotal - slotsUsed !== 1 ? "s" : ""} remaining —{" "}
              <Link href="/dashboard/subscription" className="underline">upgrade</Link> for more
            </p>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Quick actions ────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: isLandlord ? "Add Property" : "New Listing", icon: PlusCircle, href: "/dashboard/listings/new", color: "text-primary" },
              { label: "Boost Listing", icon: Tag, href: "/dashboard/boost", color: "text-accent" },
              { label: "Messages", icon: MessageSquare, href: "/messages", color: "text-amber-500" },
              { label: "Analytics", icon: BarChart2, href: "/dashboard/analytics", color: "text-blue-500" },
              { label: "Wallet", icon: Wallet, href: "/dashboard/wallet", color: "text-green-500" },
              { label: "Escrow", icon: Shield, href: "/dashboard/escrow", color: "text-purple-500" },
              { label: "Subscription", icon: Crown, href: "/dashboard/subscription", color: "text-amber-500" },
            ].map(({ label, icon: Icon, href, color }) => (
              <Link key={href} href={href}>
                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:bg-secondary/50 transition-colors cursor-pointer">
                  <Icon className={cn("w-4 h-4 shrink-0", color)} />
                  <span className="text-xs font-medium text-foreground">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Recent listings ──────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">My Listings</h2>
            <Link href="/dashboard/listings" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : listings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No listings yet.</p>
              <Link href="/dashboard/listings/new">
                <Button size="sm" className="mt-3 gap-1"><PlusCircle className="w-3.5 h-3.5" /> Create your first</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {listings.slice(0, 5).map((l) => (
                <Link key={l.id} href={`/listings/${l.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                    <div className="relative w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary">
                      {l.images?.[0] && <Image src={l.images[0]} alt={l.title} fill className="object-cover" sizes="48px" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[l.status] ?? "bg-gray-400")} />
                        <span className="text-xs text-muted-foreground capitalize">{l.status}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <Eye className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{l.viewsCount ?? 0}</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-foreground shrink-0">{formatCurrency(l.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Pending bookings ──────────────────────────────────────────────── */}
        {pendingBookings.length > 0 && (
          <div className="bg-card border-2 border-amber-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Viewing Requests
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingBookings.length}
                </span>
              </h2>
              <Link href="/dashboard/bookings" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
              {pendingBookings.slice(0, 3).map((b) => (
                <div key={b.id} className="p-3 rounded-xl bg-secondary/50">
                  <p className="text-sm font-medium text-foreground truncate">{b.listingTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.message}</p>
                  <div className="flex gap-2 mt-2">
                    <Link href="/dashboard/bookings">
                      <Button size="sm" className="h-7 text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Review
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Active escrow deals ───────────────────────────────────────────── */}
        <div className={cn("bg-card border border-border rounded-2xl p-5", pendingBookings.length > 0 ? "lg:col-span-2" : "lg:col-span-3")}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Escrow Deals
            </h2>
            <Link href="/dashboard/escrow" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          ) : activeEscrows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No active escrow deals.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeEscrows.slice(0, 4).map((e) => (
                <Link key={e.id} href={`/dashboard/escrow/${e.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                    <Shield className="w-8 h-8 p-2 rounded-lg bg-primary/10 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{e.listingTitle}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(e.amount)}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ESCROW_COLOR[e.status] ?? "bg-secondary text-muted-foreground")}>
                        {e.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Recent wallet transactions ────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-500" /> Wallet
              {wallet && (
                <span className="text-sm font-bold text-green-600 ml-1">{formatCurrency(wallet.balance)}</span>
              )}
            </h2>
            <Link href="/dashboard/wallet" className="text-xs text-primary hover:underline flex items-center gap-1">
              View wallet <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {walletTxns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {walletTxns.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(t.createdAt)}</p>
                  </div>
                  <p className={cn("text-sm font-bold", t.type === "credit" ? "text-green-600" : "text-red-500")}>
                    {t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
