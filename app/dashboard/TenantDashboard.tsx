"use client";

/**
 * TenantDashboard — for role: tenant
 *
 * Sections:
 *  1. Welcome + escrow protection banner
 *  2. Stats: Active Escrows / Saved Properties / Pending Bookings / Messages
 *  3. Quick actions
 *  4. Active escrow deals (buyer view)
 *  5. Recent bookings made
 *  6. Saved properties
 *  7. Saved searches
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, BookmarkPlus, Building2, CheckCircle2,
  Clock, Heart, MessageSquare, Search, Shield, Star,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getMyEscrows } from "@/services/escrow";
import { getSavedListings } from "@/services/listings";
import { getMyBookings } from "@/services/bookings";
import { getMySavedSearches } from "@/services/savedSearches";
import { getMyConversations } from "@/services/messages";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import type { EscrowTransaction, PropertyListing, Booking } from "@/types";
import type { SavedSearch } from "@/services/savedSearches";

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

const PLACEHOLDER = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=200&q=70";

function StatCard({
  label, value, icon: Icon, color = "text-primary", href,
}: {
  label: string; value: string | number;
  icon: React.ElementType; color?: string; href?: string;
}) {
  const inner = (
    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-serif font-bold text-foreground">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function TenantDashboard() {
  const { user } = useAuth();

  const [escrows, setEscrows]         = useState<EscrowTransaction[]>([]);
  const [saved, setSaved]             = useState<PropertyListing[]>([]);
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [searches, setSearches]       = useState<SavedSearch[]>([]);
  const [unreadMsgs, setUnreadMsgs]   = useState(0);
  const [isLoading, setIsLoading]     = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyEscrows(user.id),
      getSavedListings(user.id),
      getMyBookings(user.id),
      getMySavedSearches(user.id),
      getMyConversations(user.id),
    ])
      .then(([e, s, b, sr, convs]) => {
        setEscrows(e);
        setSaved(s);
        setBookings(b.filter(bk => bk.buyerId === user.id));
        setSearches(sr);
        const unread = convs.filter(c => c.unreadFor === user.id && c.unreadCount > 0).length;
        setUnreadMsgs(unread);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [user]);

  const activeEscrows   = escrows.filter(e => !["released","refunded","resolved","cancelled"].includes(e.status));
  const pendingBookings = bookings.filter(b => b.status === "pending");

  return (
    <DashboardLayout>
      {/* ── Welcome ───────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">
          Welcome, {user?.firstName || user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your property search and transactions.
        </p>
      </div>

      {/* ── Escrow banner ─────────────────────────────────────────────────── */}
      {activeEscrows.length === 0 && (
        <div className="mb-5 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Safe payments with Escrow</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your money is held securely until you confirm the property is as described.
              </p>
            </div>
          </div>
          <Link href="/listings">
            <Button size="sm" className="shrink-0 gap-2">
              <Search className="w-3.5 h-3.5" /> Browse Listings
            </Button>
          </Link>
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Escrows" value={activeEscrows.length}
            icon={Shield} color="text-primary" href="/dashboard/escrow" />
          <StatCard label="Saved Properties" value={saved.length}
            icon={Heart} color="text-red-500" href="/dashboard/saved" />
          <StatCard label="My Bookings" value={bookings.length}
            icon={Clock} color="text-amber-500" href="/dashboard/bookings" />
          <StatCard label="Messages" value={unreadMsgs > 0 ? `${unreadMsgs} unread` : "0"}
            icon={MessageSquare} color="text-blue-500" href="/messages" />
        </div>
      )}

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Browse Listings",   icon: Search,        href: "/listings",            color: "text-primary" },
            { label: "My Escrows",        icon: Shield,        href: "/dashboard/escrow",    color: "text-primary" },
            { label: "Saved Properties",  icon: Heart,         href: "/dashboard/saved",     color: "text-red-500" },
            { label: "Messages",          icon: MessageSquare, href: "/messages",            color: "text-blue-500" },
          ].map(({ label, icon: Icon, href, color }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border hover:bg-secondary/50 hover:border-primary/30 transition-colors text-center cursor-pointer">
                <Icon className={cn("w-5 h-5", color)} />
                <span className="text-xs font-medium text-foreground">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Active escrow deals ────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> My Escrow Deals
            </h2>
            <Link href="/dashboard/escrow" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : activeEscrows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No active escrow deals</p>
              <p className="text-xs text-muted-foreground mt-1">
                When you pay for a property through escrow, it appears here.
              </p>
              <Link href="/listings">
                <Button size="sm" variant="outline" className="mt-3 gap-1">
                  <Search className="w-3.5 h-3.5" /> Browse listings
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activeEscrows.slice(0, 5).map((e) => (
                <Link key={e.id} href={`/dashboard/escrow/${e.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                    <div className="relative w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary">
                      {e.listingImage && (
                        <Image src={e.listingImage} alt={e.listingTitle} fill className="object-cover" sizes="48px" />
                      )}
                    </div>
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

        {/* ── My Bookings ────────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> My Bookings
              {pendingBookings.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingBookings.length} pending
                </span>
              )}
            </h2>
            <Link href="/dashboard/bookings" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No bookings yet</p>
              <p className="text-xs mt-1">Request a viewing from any listing page</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                  <div className="relative w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary">
                    {b.listingImage && (
                      <Image src={b.listingImage} alt={b.listingTitle} fill className="object-cover" sizes="48px" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{b.listingTitle}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(b.createdAt)}</p>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", BOOKING_COLOR[b.status] ?? "bg-secondary text-muted-foreground")}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Saved properties ────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" /> Saved Properties
            </h2>
            <Link href="/dashboard/saved" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : saved.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Heart className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No saved properties</p>
              <p className="text-xs mt-1">Heart a listing to save it for later</p>
            </div>
          ) : (
            <div className="space-y-2">
              {saved.slice(0, 5).map((l) => (
                <Link key={l.id} href={`/listings/${l.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                    <div className="relative w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary">
                      <Image src={l.images?.[0] ?? PLACEHOLDER} alt={l.title} fill className="object-cover" sizes="48px" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.location?.lga}, {l.location?.state}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0">{formatCurrency(l.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Saved searches ───────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4 text-blue-500" /> Saved Searches
            </h2>
            <Link href="/listings" className="text-xs text-primary hover:underline flex items-center gap-1">
              Browse <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}</div>
          ) : searches.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <BookmarkPlus className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No saved searches</p>
              <p className="text-xs mt-1">Save a search to get notified when new listings match</p>
            </div>
          ) : (
            <div className="space-y-2">
              {searches.slice(0, 6).map((s) => (
                <Link key={s.id} href={`/listings?${new URLSearchParams(Object.entries(s.filters ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 transition-colors">
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(s.createdAt)}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
