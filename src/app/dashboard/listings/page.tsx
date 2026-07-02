"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Building2, Edit2, Eye, MoreVertical, Pause, Play,
  PlusCircle, Star, Trash2, TrendingUp,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getMyListings, updateListing, deleteListing } from "@/services/listings";
import { useAuth } from "@/hooks/useAuth";
import { formatPriceLabel, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { PropertyListing } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-600",
  paused: "bg-yellow-100 text-yellow-700",
  sold: "bg-blue-100 text-blue-700",
  rented: "bg-purple-100 text-purple-700",
};

export default function MyListingsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMyListings(user.id)
      .then(setListings)
      .catch(() => toast.error("Failed to load listings"))
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleToggle = async (listing: PropertyListing) => {
    const newStatus = listing.status === "active" ? "paused" : "active";
    try {
      await updateListing(listing.id, { status: newStatus });
      setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, status: newStatus } : l));
      toast.success(`Listing ${newStatus === "active" ? "activated" : "paused"}`);
    } catch { toast.error("Failed to update listing"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    try {
      await deleteListing(id);
      setListings((prev) => prev.filter((l) => l.id !== id));
      toast.success("Listing deleted");
    } catch { toast.error("Failed to delete listing"); }
  };

  const activeCount = listings.filter((l) => l.status === "active").length;
  const totalViews = listings.reduce((acc, l) => acc + (l.viewsCount ?? 0), 0);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">My Listings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {listings.length} listing{listings.length !== 1 ? "s" : ""} · {activeCount} active · {totalViews.toLocaleString()} total views
          </p>
        </div>
        <Link href="/dashboard/listings/new">
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" /> New Listing
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Building2 className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No listings yet</h2>
          <p className="text-muted-foreground mb-6 text-sm">Create your first listing to start getting leads.</p>
          <Link href="/dashboard/listings/new">
            <Button className="gap-2">
              <PlusCircle className="w-4 h-4" /> Create Listing
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="bg-card border border-border rounded-2xl p-4 flex gap-4 items-start">
              {/* Image */}
              <div className="relative w-20 h-16 rounded-xl overflow-hidden shrink-0">
                <Image
                  src={listing.images?.[0] ?? "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=200"}
                  alt={listing.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[listing.status] ?? "bg-secondary text-secondary-foreground"}`}>
                    {listing.status}
                  </span>
                  {listing.boostType !== "none" && (
                    <Badge className="text-xs bg-accent/20 text-accent-foreground border-accent/30">
                      <Star className="w-2.5 h-2.5 mr-1" /> {listing.boostType?.replace("_", " ")}
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-foreground text-sm truncate">{listing.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {listing.location.lga}, {listing.location.state} · {formatPriceLabel(listing.price, listing.priceUnit)}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {listing.viewsCount}</span>
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {listing.inquiriesCount} inquiries</span>
                  <span>{timeAgo(listing.createdAt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/listings/${listing.id}`}>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
                    <Eye className="w-3 h-3" /> View
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* ✅ FIX: Edit2 icon was imported but never actually
                        used anywhere — the Edit action itself was missing
                        from this menu, even though the edit page already
                        exists at /dashboard/listings/edit/[id]. */}
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/listings/edit/${listing.id}`}>
                        <Edit2 className="mr-2 h-4 w-4" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(listing)}>
                      {listing.status === "active"
                        ? <><Pause className="mr-2 h-4 w-4" /> Pause</>
                        : <><Play className="mr-2 h-4 w-4" /> Activate</>
                      }
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/boost?id=${listing.id}`}>
                        <Star className="mr-2 h-4 w-4" /> Boost
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(listing.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
