"use client";

import { useEffect, useState } from "react";
import { BarChart2, Eye, Heart, MessageSquare, TrendingUp, Tag, ArrowUpRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { getMyListings } from "@/services/listings";
import { getMultipleListingAnalytics, type ListingAnalytics } from "@/services/analytics";
import { formatCurrency, cn } from "@/lib/utils";
import { getUserPlanStatus } from "@/services/subscriptions";
import { toast } from "sonner";
import type { PropertyListing } from "@/types";
import Link from "next/link";

export default function ListingAnalyticsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, ListingAnalytics>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [canAccessAnalytics, setCanAccessAnalytics] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    // ✅ Check if user's plan grants analytics access
    getUserPlanStatus(user.id, user.subscriptionPlan ?? "free", user.subscriptionExpiry)
      .then((status) => {
        // Free = no analytics, Basic = basic, Pro/Premium = full
        setCanAccessAnalytics(status.plan.slug !== "free");
      })
      .catch(() => setCanAccessAnalytics(true)); // fail open

    getMyListings(user.id)
      .then(async (ls) => {
        setListings(ls);
        if (ls.length > 0) {
          const dataArr = await getMultipleListingAnalytics(ls.map((l) => l.id));
          const dataMap: Record<string, typeof dataArr[0]> = {};
          dataArr.forEach((a) => { dataMap[a.listingId] = a; });
          setAnalytics(dataMap);
        }
      })
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setIsLoading(false));
  }, [user]);

  const totalViews = Object.values(analytics).reduce((s, a) => s + a.views, 0);
  const totalSaves = Object.values(analytics).reduce((s, a) => s + a.saves, 0);
  const totalInquiries = Object.values(analytics).reduce((s, a) => s + a.inquiries, 0);
  const totalOffers = Object.values(analytics).reduce((s, a) => s + a.offers, 0);

  // ✅ Gate: free plan gets upgrade prompt
  if (canAccessAnalytics === false) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto text-center py-20">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Analytics Requires Basic+</h1>
          <p className="text-muted-foreground mb-6">
            Upgrade to Basic or higher to see how your listings are performing — views, saves, inquiries, and offer data.
          </p>
          <a href="/dashboard/subscription">
            <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
              View Plans
            </button>
          </a>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-primary" /> Listing Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">See how your listings are performing</p>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Listings", value: listings.length, icon: BarChart2, color: "text-primary" },
          { label: "Total Views", value: totalViews, icon: Eye, color: "text-blue-600" },
          { label: "Total Saves", value: totalSaves, icon: Heart, color: "text-red-500" },
          { label: "Inquiries", value: totalInquiries, icon: MessageSquare, color: "text-green-600" },
          { label: "Offers", value: totalOffers, icon: Tag, color: "text-purple-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <Icon className={cn("w-6 h-6 mx-auto mb-2", color)} />
            <p className="text-2xl font-serif font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-listing breakdown */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No listings yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const a = analytics[listing.id];
            if (!a) return null;
            return (
              <div key={listing.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{listing.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {listing.location.lga}, {listing.location.state} · {formatCurrency(listing.price)}
                    </p>
                  </div>
                  <Link href={`/listings/${listing.id}`}
                    className="flex items-center gap-1 text-xs text-primary font-medium shrink-0">
                    View <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Views", value: a.views, thisWeek: a.viewsThisWeek, icon: Eye },
                    { label: "Saves", value: a.saves, icon: Heart },
                    { label: "Inquiries", value: a.inquiries, icon: MessageSquare },
                    { label: "Offers", value: a.offers, icon: Tag },
                  ].map(({ label, value, thisWeek, icon: Icon }) => (
                    <div key={label} className="text-center">
                      <p className="text-lg font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      {thisWeek !== undefined && thisWeek > 0 && (
                        <p className="text-xs text-green-600 font-medium">+{thisWeek} this week</p>
                      )}
                    </div>
                  ))}
                </div>

                {a.views > 0 && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Conversion rate</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(a.conversionRate * 10, 100)}%` }} />
                      </div>
                      <p className="text-xs font-semibold text-foreground">{a.conversionRate}%</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
