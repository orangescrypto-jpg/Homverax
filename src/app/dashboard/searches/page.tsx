"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Search, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getMySavedSearches, deleteSavedSearch } from "@/services/savedSearches";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { SavedSearch } from "@/services/savedSearches";

function buildSearchUrl(filters: SavedSearch["filters"]): string {
  const params = new URLSearchParams();
  if (filters.query)        params.set("q", filters.query);
  if (filters.category)     params.set("category", filters.category);
  if (filters.state)        params.set("state", filters.state);
  if (filters.propertyType) params.set("propertyType", filters.propertyType);
  if (filters.listingType)  params.set("listingType", filters.listingType);
  if (filters.minPrice)     params.set("minPrice", filters.minPrice.toString());
  if (filters.maxPrice)     params.set("maxPrice", filters.maxPrice.toString());
  if (filters.bedrooms)     params.set("bedrooms", filters.bedrooms.toString());
  if (filters.verifiedOnly) params.set("verified", "true");
  return `/listings?${params.toString()}`;
}

function filterSummary(filters: SavedSearch["filters"]): string {
  const parts: string[] = [];
  if (filters.query)        parts.push(`"${filters.query}"`);
  if (filters.state)        parts.push(filters.state);
  if (filters.propertyType) parts.push(filters.propertyType);
  if (filters.listingType)  parts.push(`for ${filters.listingType}`);
  if (filters.bedrooms)     parts.push(`${filters.bedrooms}+ bed`);
  if (filters.minPrice || filters.maxPrice) {
    if (filters.minPrice && filters.maxPrice)
      parts.push(`₦${(filters.minPrice / 1000).toFixed(0)}k–₦${(filters.maxPrice / 1000).toFixed(0)}k`);
    else if (filters.minPrice)
      parts.push(`from ₦${(filters.minPrice / 1000).toFixed(0)}k`);
    else
      parts.push(`up to ₦${(filters.maxPrice! / 1000).toFixed(0)}k`);
  }
  if (filters.verifiedOnly) parts.push("verified only");
  return parts.join(" · ") || "No filters";
}

export default function SavedSearchesPage() {
  const { user } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMySavedSearches(user.id)
      .then(setSearches)
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleDelete = async (id: string) => {
    await deleteSavedSearch(id);
    setSearches((prev) => prev.filter((s) => s.id !== id));
    toast.success("Saved search removed");
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Saved Searches</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Quickly re-run searches and get notified when matching listings appear.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : searches.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Search className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No saved searches</h2>
          <p className="text-muted-foreground text-sm mb-6">
            When browsing listings, use the "Save Search" button to save your filters here.
          </p>
          <Link href="/listings"><Button>Browse Listings</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Search className="w-5 h-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{filterSummary(s.filters)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Saved {timeAgo(s.createdAt)}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${
                  s.alertsEnabled
                    ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  {s.alertsEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                  {s.alertsEnabled ? "Alerts on" : "Alerts off"}
                </div>
                <Link href={buildSearchUrl(s.filters)}>
                  <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                    <Search className="w-3 h-3" /> Run
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(s.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
