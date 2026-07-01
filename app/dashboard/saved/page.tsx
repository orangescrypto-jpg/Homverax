"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ListingCard from "@/components/features/ListingCard";
import { getSavedListings, unsaveListing } from "@/services/listings";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { PropertyListing } from "@/types";

export default function SavedListingsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    getSavedListings(user.id)
      .then((l) => { setListings(l); setSavedIds(new Set(l.map((x) => x.id))); })
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleUnsave = async (listingId: string) => {
    if (!user) return;
    await unsaveListing(user.id, listingId);
    setListings((prev) => prev.filter((l) => l.id !== listingId));
    setSavedIds((prev) => { const s = new Set(prev); s.delete(listingId); return s; });
    toast.success("Removed from saved");
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Saved Properties</h1>
        <p className="text-muted-foreground text-sm mt-1">{listings.length} saved listing{listings.length !== 1 ? "s" : ""}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton aspect-[4/3] rounded-2xl" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Heart className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No saved listings</h2>
          <p className="text-muted-foreground text-sm">Browse listings and save the ones you like.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onSave={handleUnsave}
              isSaved={savedIds.has(listing.id)}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
