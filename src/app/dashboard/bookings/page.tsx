"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen, Calendar, CheckCircle2, ChevronRight,
  Clock, Loader2, Shield, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// ✅ FIX: Use service layer — removed direct Firestore imports (db, collection, query, etc.)
import { getMyBookings, updateBookingStatus } from "@/services/bookings";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "bg-yellow-100 text-yellow-700 border-yellow-200",  icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700 border-blue-200",        icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 border-green-200",     icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 border-red-200",           icon: X },
};

const PLACEHOLDER = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=200&q=70";

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "completed">("all");

  useEffect(() => {
    if (!user) return;
    getMyBookings(user.id)
      .then(setBookings)
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setIsLoading(false));
  }, [user]);

  const act = async (id: string, status: Booking["status"], msg: string) => {
    setActing(id);
    try {
      await updateBookingStatus(id, status);
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
      toast.success(msg);
    } catch { toast.error("Action failed"); }
    finally { setActing(null); }
  };

  const filtered = bookings.filter((b) => filter === "all" || b.status === filter);
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">My Bookings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {bookings.length} total · {pendingCount} pending action
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-secondary/50 p-1 rounded-xl w-fit">
        {(["all", "pending", "confirmed", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
              filter === f
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <BookOpen className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No bookings yet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {filter === "all"
              ? "When you request or receive bookings, they'll appear here."
              : `No ${filter} bookings.`}
          </p>
          <Link href="/listings"><Button>Browse Listings</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => {
            const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const isBuyer = booking.buyerId === user?.id;
            const isActing = acting === booking.id;

            return (
              <div key={booking.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex gap-4">
                  {/* Listing image */}
                  <div className="relative w-20 h-16 rounded-xl overflow-hidden shrink-0">
                    <Image
                      src={booking.listingImage || PLACEHOLDER}
                      alt={booking.listingTitle}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm truncate">
                        {booking.listingTitle}
                      </h3>
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1",
                        cfg.color
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span>{isBuyer ? "You are the buyer" : "You are the seller"}</span>
                      {booking.listingPrice && (
                        <span className="font-medium text-foreground">
                          {formatCurrency(booking.listingPrice)}
                        </span>
                      )}
                      <span>{timeAgo(booking.createdAt)}</span>
                    </div>

                    {booking.message && (
                      <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-2.5 py-1.5 mb-2 line-clamp-2">
                        "{booking.message}"
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {/* Seller: confirm pending booking */}
                      {!isBuyer && booking.status === "pending" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={isActing}
                          onClick={() => act(booking.id, "confirmed", "Booking confirmed!")}
                        >
                          {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Confirm
                        </Button>
                      )}

                      {/* Buyer: go to escrow once confirmed */}
                      {isBuyer && booking.status === "confirmed" && (
                        <Link href={booking.escrowId ? `/dashboard/escrow/${booking.escrowId}` : "/dashboard/escrow"}>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                            <Shield className="w-3 h-3" /> Escrow Payment
                          </Button>
                        </Link>
                      )}

                      {/* Both: cancel pending */}
                      {["pending", "confirmed"].includes(booking.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                          disabled={isActing}
                          onClick={() => act(booking.id, "cancelled", "Booking cancelled")}
                        >
                          {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          Cancel
                        </Button>
                      )}

                      <Link href={`/listings/${booking.listingId}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground">
                          View Listing <ChevronRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
