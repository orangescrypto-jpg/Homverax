"use client";

/**
 * ServiceProviderDashboard — for role: service_provider
 *
 * Completely different from agent/tenant.
 *
 * Sections:
 *  1. Welcome + verification banner
 *  2. Stats: Active Services / Bookings Received / Wallet Balance / Avg Rating
 *  3. Quick actions
 *  4. Pending booking requests (from buyers/tenants)
 *  5. Active escrow deals (their service payments)
 *  6. My services (listings)
 *  7. Recent reviews received
 *  8. Wallet / recent earnings
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, CheckCircle2, Clock, PlusCircle,
  Shield, Star, Tag, Wallet, Wrench, X, Crown,
  BarChart2, MessageSquare, AlertCircle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getMyListings } from "@/services/listings";
import { getMyEscrows } from "@/services/escrow";
import { getMyBookings } from "@/services/bookings";
import { getOrCreateWallet, getWalletTransactions } from "@/services/wallet";
import { getUserReviews, getUserRatingSummary } from "@/services/reviews";
import { getUserPlanStatus } from "@/services/subscriptions";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import type { PropertyListing, EscrowTransaction, Booking } from "@/types";
import type { SellerWallet, WalletTransaction } from "@/services/wallet";
import type { Review, UserRatingsSummary } from "@/services/reviews";
import type { PlanStatus } from "@/services/subscriptions";

const ESCROW_COLOR: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  funded:     "bg-blue-100 text-blue-700",
  held:       "bg-indigo-100 text-indigo-700",
  inspection: "bg-purple-100 text-purple-700",
  released:   "bg-green-100 text-green-700",
  disputed:   "bg-red-100 text-red-700",
};

const BOOKING_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
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

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={cn("w-3.5 h-3.5", s <= Math.round(rating) ? "fill-accent text-accent" : "text-border")} />
      ))}
    </div>
  );
}

export default function ServiceProviderDashboard() {
  const { user } = useAuth();

  const [services, setServices]         = useState<PropertyListing[]>([]);
  const [escrows, setEscrows]           = useState<EscrowTransaction[]>([]);
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [wallet, setWallet]             = useState<SellerWallet | null>(null);
  const [walletTxns, setWalletTxns]     = useState<WalletTransaction[]>([]);
  const [reviews, setReviews]           = useState<Review[]>([]);
  const [ratingSummary, setRating]      = useState<UserRatingsSummary | null>(null);
  const [planStatus, setPlanStatus]     = useState<PlanStatus | null>(null);
  const [isLoading, setIsLoading]       = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyListings(user.id),
      getMyEscrows(user.id),
      getMyBookings(user.id),
      getOrCreateWallet(user.id),
      getWalletTransactions(user.id, 5),
      getUserReviews(user.id, 5),
      getUserRatingSummary(user.id),
      getUserPlanStatus(user.id, user.subscriptionPlan ?? "free", user.subscriptionExpiry),
    ])
      .then(([s, e, b, w, wt, r, rs, ps]) => {
        setServices(s);
        setEscrows(e);
        // Bookings received as the seller/provider
        setBookings(b.filter(bk => bk.sellerId === user.id));
        setWallet(w);
        setWalletTxns(wt);
        setReviews(r);
        setRating(rs);
        setPlanStatus(ps);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [user]);

  const activeServices   = services.filter(s => s.status === "active");
  const activeEscrows    = escrows.filter(e => !["released","refunded","resolved","cancelled"].includes(e.status));
  const pendingBookings  = bookings.filter(b => b.status === "pending");
  const confirmedBookings = bookings.filter(b => b.status === "confirmed");
  const avgRating        = ratingSummary?.averageRating ?? 0;
  const maxListings      = planStatus ? (planStatus.plan.maxListings === 999999 ? Infinity : planStatus.plan.maxListings) : 3;
  const slotsUsed        = activeServices.length;
  const slotsTotal       = maxListings === Infinity ? null : maxListings as number;
  const slotsPct         = slotsTotal ? Math.min(100, (slotsUsed / slotsTotal) * 100) : 0;

  return (
    <DashboardLayout>
      {/* ── Welcome ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            Welcome back, {user?.firstName || user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your service bookings and earnings.
          </p>
        </div>
        <Link href="/dashboard/listings/new">
          <Button className="gap-2 shrink-0">
            <PlusCircle className="w-4 h-4" /> Add Service
          </Button>
        </Link>
      </div>

      {/* ── Verification banner ──────────────────────────────────────────── */}
      {user?.verificationStatus !== "approved" && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {user?.verificationStatus === "pending" ? "Verification in progress" : "Get verified to win more bookings"}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Verified service providers get 3× more bookings and a trusted badge on their listings.
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Services" value={activeServices.length}
            sub={`${services.length} total`} icon={Wrench} href="/dashboard/listings" />
          <StatCard label="Bookings Received" value={bookings.length}
            sub={`${pendingBookings.length} pending`} icon={Clock}
            color="text-amber-500" href="/dashboard/bookings" />
          <StatCard label="Wallet Balance" value={wallet ? formatCurrency(wallet.balance) : "₦0"}
            sub={wallet?.pendingBalance ? `+ ${formatCurrency(wallet.pendingBalance)} pending` : "Available to withdraw"}
            icon={Wallet} color="text-green-500" href="/dashboard/wallet" />
          <StatCard
            label="Avg Rating"
            value={avgRating > 0 ? avgRating.toFixed(1) : "—"}
            sub={ratingSummary?.totalReviews ? `${ratingSummary.totalReviews} review${ratingSummary.totalReviews !== 1 ? "s" : ""}` : "No reviews yet"}
            icon={Star} color="text-accent"
          />
        </div>
      )}

      {/* ── Plan usage ────────────────────────────────────────────────────── */}
      {planStatus && slotsTotal && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground capitalize">{planStatus.plan.name} Plan</span>
            </div>
            <span className="text-sm font-bold text-foreground">{slotsUsed} / {slotsTotal} services</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all",
              slotsPct >= 100 ? "bg-red-500" : slotsPct >= 80 ? "bg-amber-500" : "bg-primary"
            )} style={{ width: `${slotsPct}%` }} />
          </div>
          {slotsPct >= 100 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Service limit reached
              </p>
              <Link href="/dashboard/subscription" className="text-xs text-primary font-semibold hover:underline">Upgrade →</Link>
            </div>
          )}
        </div>
      )}

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Add Service",    icon: PlusCircle,    href: "/dashboard/listings/new", color: "text-primary" },
            { label: "Boost Service",  icon: Tag,           href: "/dashboard/boost",        color: "text-accent" },
            { label: "Analytics",      icon: BarChart2,     href: "/dashboard/analytics",    color: "text-blue-500" },
            { label: "Messages",       icon: MessageSquare, href: "/messages",               color: "text-indigo-500" },
            { label: "Escrow Deals",   icon: Shield,        href: "/dashboard/escrow",       color: "text-purple-500" },
            { label: "Wallet",         icon: Wallet,        href: "/dashboard/wallet",       color: "text-green-500" },
            { label: "Subscription",   icon: Crown,         href: "/dashboard/subscription", color: "text-amber-500" },
            { label: "Get Verified",   icon: CheckCircle2,  href: "/dashboard/verification", color: "text-teal-500" },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Pending booking requests ──────────────────────────────────────── */}
        {pendingBookings.length > 0 && (
          <div className="bg-card border-2 border-amber-200 rounded-2xl p-5 lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Booking Requests
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingBookings.length} new
                </span>
              </h2>
              <Link href="/dashboard/bookings" className="text-xs text-primary hover:underline">Manage all</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingBookings.slice(0, 3).map((b) => (
                <div key={b.id} className="bg-secondary/40 rounded-xl p-4">
                  <p className="text-sm font-semibold text-foreground truncate">{b.listingTitle}</p>
                  {b.message && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">"{b.message}"</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(b.createdAt)}</p>
                  <Link href="/dashboard/bookings">
                    <Button size="sm" className="w-full mt-3 h-7 text-xs gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Review & Confirm
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Active services ────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" /> My Services
            </h2>
            <Link href="/dashboard/listings" className="text-xs text-primary hover:underline flex items-center gap-1">
              Manage all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : services.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No services listed yet</p>
              <Link href="/dashboard/listings/new">
                <Button size="sm" className="mt-3 gap-1"><PlusCircle className="w-3.5 h-3.5" /> Add your first service</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {services.slice(0, 5).map((s) => (
                <Link key={s.id} href={`/listings/${s.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                    <div className="relative w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary">
                      {s.images?.[0] && <Image src={s.images[0]} alt={s.title} fill className="object-cover" sizes="48px" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                          s.status === "active" ? "bg-green-500" : "bg-gray-400"
                        )} />
                        <span className="text-xs text-muted-foreground capitalize">{s.status}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{s.viewsCount ?? 0} views</span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0">{formatCurrency(s.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Reviews received ───────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-accent" /> Reviews
            </h2>
            {avgRating > 0 && (
              <div className="flex items-center gap-1.5">
                <StarDisplay rating={avgRating} />
                <span className="text-sm font-bold text-foreground">{avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No reviews yet</p>
              <p className="text-xs mt-1">Reviews appear after completed escrow deals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.slice(0, 4).map((r) => (
                <div key={r.id} className="bg-secondary/30 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{r.reviewerName}</p>
                    <StarDisplay rating={r.rating} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">"{r.comment}"</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(r.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Active escrow deals ────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" /> Escrow Deals
            </h2>
            <Link href="/dashboard/escrow" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {activeEscrows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No active escrow deals.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeEscrows.slice(0, 4).map((e) => (
                <Link key={e.id} href={`/dashboard/escrow/${e.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                    <Shield className="w-8 h-8 p-2 rounded-lg bg-purple-100 text-purple-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{e.listingTitle}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatCurrency(e.amount)}</p>
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

        {/* ── Wallet / earnings ──────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-500" /> Wallet
              {wallet && (
                <span className="text-base font-bold text-green-600">{formatCurrency(wallet.balance)}</span>
              )}
            </h2>
            <Link href="/dashboard/wallet" className="text-xs text-primary hover:underline flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {wallet?.pendingBalance && wallet.pendingBalance > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700">
              <span className="font-semibold">{formatCurrency(wallet.pendingBalance)}</span> pending from active escrows
            </div>
          ) : null}
          {walletTxns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {walletTxns.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-xs font-medium text-foreground truncate">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(t.createdAt)}</p>
                  </div>
                  <p className={cn("text-sm font-bold shrink-0", t.type === "credit" ? "text-green-600" : "text-red-500")}>
                    {t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/wallet">
            <Button variant="outline" size="sm" className="w-full mt-3 gap-2">
              <Wallet className="w-3.5 h-3.5" /> Request Payout
            </Button>
          </Link>
        </div>

      </div>
    </DashboardLayout>
  );
}
