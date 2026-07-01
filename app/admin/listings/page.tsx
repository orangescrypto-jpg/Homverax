"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Building2, CheckCircle2, Eye, Loader2, Pause, Play, Search, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// ✅ FIX: Use service layer — updateListing, deleteListing, getAllListingsAdmin
import { updateListing, deleteListing, getAllListingsAdmin } from "@/services/listings";
import { formatPriceLabel, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PropertyListing } from "@/types";

const PLACEHOLDER = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=200&q=70";

const STATUS_COLOR: Record<string, string> = {
  active:  "bg-green-100 text-green-700",
  draft:   "bg-gray-100 text-gray-600",
  paused:  "bg-yellow-100 text-yellow-700",
  sold:    "bg-blue-100 text-blue-700",
  rented:  "bg-purple-100 text-purple-700",
};

export default function AdminListingsPage() {
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [filtered, setFiltered] = useState<PropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    // ✅ FIX: getAllListingsAdmin() from service layer
    getAllListingsAdmin(200)
      .then((list) => { setListings(list); setFiltered(list); })
      .catch(() => toast.error("Failed to load listings"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    let result = listings;
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.location?.state?.toLowerCase().includes(q) ||
          l.location?.lga?.toLowerCase().includes(q) ||
          l.agentId?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [searchQuery, statusFilter, listings]);

  const handleToggle = async (listing: PropertyListing) => {
    const newStatus = listing.status === "active" ? "paused" : "active";
    setActing(listing.id);
    try {
      // ✅ FIX: updateListing() from service layer
      await updateListing(listing.id, { status: newStatus } as any);
      setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, status: newStatus } : l));
      toast.success(`Listing ${newStatus === "active" ? "activated" : "paused"}`);
    } catch { toast.error("Failed to update listing"); }
    finally { setActing(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this listing?")) return;
    setActing(id);
    try {
      // ✅ FIX: deleteListing() from service layer
      await deleteListing(id);
      setListings((prev) => prev.filter((l) => l.id !== id));
      toast.success("Listing deleted");
    } catch { toast.error("Failed to delete"); }
    finally { setActing(null); }
  };

  const counts = {
    all: listings.length,
    active: listings.filter((l) => l.status === "active").length,
    paused: listings.filter((l) => l.status === "paused").length,
    draft: listings.filter((l) => l.status === "draft").length,
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Manage Listings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {listings.length} total · {counts.active} active · {counts.paused} paused
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(["all", "active", "paused", "draft"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "bg-card border rounded-xl p-3 text-center transition-all",
              statusFilter === s ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            )}
          >
            <p className="text-lg font-serif font-bold text-foreground">{counts[s]}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{s}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 mb-5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search listings by title, location, agent ID…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")}><X className="w-4 h-4 text-muted-foreground" /></button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground text-sm">No listings found</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((l) => (
              <div key={l.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0">
                  <Image
                    src={l.images?.[0] ?? PLACEHOLDER}
                    alt={l.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{l.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {l.location?.lga}, {l.location?.state} · {formatPriceLabel(l.price, l.priceUnit)}
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo(l.createdAt)}</p>
                </div>

                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", STATUS_COLOR[l.status] ?? "bg-secondary")}>
                  {l.status}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Link href={`/listings/${l.id}`} target="_blank">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={acting === l.id}
                    onClick={() => handleToggle(l)}
                  >
                    {acting === l.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : l.status === "active" ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={acting === l.id}
                    onClick={() => handleDelete(l.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
