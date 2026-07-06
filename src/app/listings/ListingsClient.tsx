"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BookmarkPlus, Building2, Grid3X3, LayoutList, Map, Search,
  SlidersHorizontal, X,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ListingCard from "@/components/features/ListingCard";
import MapView from "@/components/features/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { searchListings, saveListing, unsaveListing } from "@/services/listings";
import { saveSearch } from "@/services/savedSearches";
import { useAuth } from "@/hooks/useAuth";
import { NIGERIAN_STATES, PROPERTY_TYPES, LAND_TYPES, SHORTLET_TYPES, ARTISANS_REPAIR_TYPES, BUILDING_MATERIALS_TYPES, FURNITURE_HOME_TYPES, SOLAR_POWER_TYPES, HOME_SERVICE_TYPES, FOOD_GROCERY_TYPES, CLEANING_HOUSEHOLD_TYPES } from "@/lib/constants";
import { toast } from "sonner";
import type { PropertyListing, ListingFilters } from "@/types";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list" | "map";

interface ListingsClientProps {
  defaultFilters?: Partial<ListingFilters>;
  heroTitle?: string;
  heroSubtitle?: string;
  pageSlug?: string;
}

const PRICE_PRESETS = [
  { label: "Under ₦500k", min: 0, max: 500000 },
  { label: "₦500k–1M", min: 500000, max: 1000000 },
  { label: "₦1M–3M", min: 1000000, max: 3000000 },
  { label: "₦3M–10M", min: 3000000, max: 10000000 },
  { label: "₦10M+", min: 10000000, max: undefined },
];

function ListingsContent({ defaultFilters, heroTitle, heroSubtitle, pageSlug }: ListingsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Filters
  const [query, setQuery] = useState(searchParams.get("q") ?? defaultFilters?.query ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? defaultFilters?.category ?? "");
  const [propertyType, setPropertyType] = useState(searchParams.get("propertyType") ?? defaultFilters?.propertyType ?? "");
  const [state, setState] = useState(searchParams.get("state") ?? defaultFilters?.state ?? "");
  const [listingType, setListingType] = useState(searchParams.get("listingType") ?? defaultFilters?.listingType ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? (defaultFilters?.minPrice ? String(defaultFilters.minPrice) : ""));
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? (defaultFilters?.maxPrice ? String(defaultFilters.maxPrice) : ""));
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") ?? (defaultFilters?.bedrooms ? String(defaultFilters.bedrooms) : ""));
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get("verified") === "true" || !!defaultFilters?.verifiedOnly);
  const [furnished, setFurnished] = useState<boolean | undefined>(defaultFilters?.furnished);

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: ListingFilters = {
        query: query || undefined,
        category: (category as ListingFilters["category"]) || undefined,
        propertyType: propertyType || undefined,
        state: state || undefined,
        listingType: listingType || undefined,
        minPrice: minPrice ? parseInt(minPrice) : undefined,
        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
        bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
        verifiedOnly: verifiedOnly || undefined,
        furnished,
        page,
        limit: 12,
      };
      const result = await searchListings(filters);
      setListings(result.data);
      setTotalPages(result.totalPages);
    } catch {
      toast.error("Failed to load listings");
    } finally {
      setIsLoading(false);
    }
  }, [query, category, propertyType, state, listingType, minPrice, maxPrice, bedrooms, verifiedOnly, furnished, page]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleSearch = () => { setPage(0); fetchListings(); };

  const handleSaveSearch = async () => {
    if (!isAuthenticated || !user) { router.push("/login"); return; }
    const activeFilters: ListingFilters = {
      query: query || undefined,
      category: (category as ListingFilters["category"]) || undefined,
      state: state || undefined,
      propertyType: propertyType || undefined,
      listingType: listingType || undefined,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      verifiedOnly: verifiedOnly || undefined,
      furnished,
    };
    const name = [query, state, propertyType, listingType].filter(Boolean).join(", ") || "My Search";
    try {
      await saveSearch(user.id, name, activeFilters);
      toast.success("Search saved! Check Saved Searches in your dashboard.");
    } catch { toast.error("Failed to save search"); }
  };

  const handleSave = async (listingId: string) => {
    if (!isAuthenticated || !user) { router.push("/login"); return; }
    try {
      if (savedIds.has(listingId)) {
        await unsaveListing(user.id, listingId);
        setSavedIds((prev) => { const s = new Set(prev); s.delete(listingId); return s; });
        toast.success("Removed from saved");
      } else {
        await saveListing(user.id, listingId);
        setSavedIds((prev) => new Set(prev).add(listingId));
        toast.success("Listing saved!");
      }
    } catch { toast.error("Failed to save listing"); }
  };

  const applyPricePreset = (min: number, max: number | undefined) => {
    setMinPrice(min.toString());
    setMaxPrice(max?.toString() ?? "");
  };

  const clearFilters = () => {
    setQuery(""); setCategory(""); setPropertyType(""); setState("");
    setListingType(""); setMinPrice(""); setMaxPrice(""); setBedrooms("");
    setVerifiedOnly(false); setFurnished(undefined); setPage(0);
  };

  const activeFilterCount = [category, propertyType, state, listingType, minPrice, maxPrice, bedrooms, verifiedOnly, furnished !== undefined].filter(Boolean).length;
  const propertyTypeOptions =
    category === "land"                ? LAND_TYPES :
    category === "shortlets"           ? SHORTLET_TYPES :
    category === "artisans_repair"     ? ARTISANS_REPAIR_TYPES :
    category === "building_materials"  ? BUILDING_MATERIALS_TYPES :
    category === "furniture_home"      ? FURNITURE_HOME_TYPES :
    category === "solar_power"         ? SOLAR_POWER_TYPES :
    category === "home_service"        ? HOME_SERVICE_TYPES :
    category === "food_grocery"        ? FOOD_GROCERY_TYPES :
    category === "cleaning_household"  ? CLEANING_HOUSEHOLD_TYPES :
    PROPERTY_TYPES;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {(heroTitle || heroSubtitle) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-2">
          {heroTitle && (
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{heroTitle}</h1>
          )}
          {heroSubtitle && (
            <p className="text-sm text-muted-foreground mt-1">{heroSubtitle}</p>
          )}
        </div>
      )}

      {/* Sticky search bar */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search location, title…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && <button onClick={() => setQuery("")}><X className="w-4 h-4 text-muted-foreground" /></button>}
            </div>

            <Button onClick={handleSearch} className="rounded-xl shrink-0">Search</Button>

            <Button
              variant="outline"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn("rounded-xl gap-2 shrink-0", filtersOpen && "border-primary text-primary")}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {/* View mode */}
            <div className="hidden sm:flex items-center gap-1 border border-border rounded-xl p-1">
              {([
                { mode: "grid" as ViewMode, icon: Grid3X3 },
                { mode: "list" as ViewMode, icon: LayoutList },
                { mode: "map" as ViewMode, icon: Map },
              ]).map(({ mode, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn("p-1.5 rounded-lg transition-colors",
                    viewMode === mode ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  title={`${mode} view`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Expanded filter panel */}
          {filtersOpen && (
            <div className="mt-3 p-4 bg-card border border-border rounded-2xl space-y-4">
              {/* Price presets */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Quick Price Range</Label>
                <div className="flex flex-wrap gap-2">
                  {PRICE_PRESETS.map((preset) => {
                    const isActive = minPrice === preset.min.toString() && maxPrice === (preset.max?.toString() ?? "");
                    return (
                      <button
                        key={preset.label}
                        onClick={() => applyPricePreset(preset.min, preset.max)}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-lg border transition-all",
                          isActive ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1 block">Category</Label>
                  <Select value={category} onValueChange={(v) => { setCategory(v); setPropertyType(""); }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="housing">Housing</SelectItem>
                      <SelectItem value="land">Land</SelectItem>
                      <SelectItem value="shortlets">Short Stays</SelectItem>
                      <SelectItem value="furniture_home">Furniture & Home</SelectItem>
                      <SelectItem value="building_materials">Building Materials</SelectItem>
                      <SelectItem value="artisans_repair">Artisans & Repairs</SelectItem>
                      <SelectItem value="solar_power">Solar & Power</SelectItem>
                      <SelectItem value="home_service">Home Services</SelectItem>
                      <SelectItem value="food_grocery">Food & Grocery</SelectItem>
                      <SelectItem value="cleaning_household">Cleaning & Household</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1 block">Type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {propertyTypeOptions.map((t: { value: string; label: string }) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1 block">State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All states" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      {NIGERIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1 block">For</Label>
                  <Select value={listingType} onValueChange={setListingType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="shortlet">Shortlet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1 block">Bedrooms</Label>
                  <Select value={bedrooms} onValueChange={setBedrooms}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {["1", "2", "3", "4", "5"].map((n) => (
                        <SelectItem key={n} value={n}>{n}+</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1 block">Furnished</Label>
                  <Select
                    value={furnished === undefined ? "" : furnished ? "yes" : "no"}
                    onValueChange={(v) => setFurnished(v === "" ? undefined : v === "yes")}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      <SelectItem value="yes">Furnished</SelectItem>
                      <SelectItem value="no">Unfurnished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex gap-3 flex-1">
                  <div className="flex-1">
                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Min Price (₦)</Label>
                    <Input
                      type="number" placeholder="0"
                      value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Max Price (₦)</Label>
                    <Input
                      type="number" placeholder="No limit"
                      value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer self-end pb-1">
                  <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="rounded" />
                  Verified only
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                    <X className="w-3 h-3 mr-1" /> Clear all
                  </Button>
                )}
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSaveSearch} className="gap-1.5">
                    <BookmarkPlus className="w-3.5 h-3.5" /> Save Search
                  </Button>
                )}
                <Button size="sm" onClick={() => { handleSearch(); setFiltersOpen(false); }}>
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Searching…" : `${listings.length} listing${listings.length !== 1 ? "s" : ""} found`}
          </p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        {/* Map view */}
        {viewMode === "map" && (
          <div className="h-[600px] mb-6 rounded-2xl overflow-hidden">
            <MapView listings={listings} />
          </div>
        )}

        {/* Grid / List view */}
        {viewMode !== "map" && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden border border-border">
                    <div className="skeleton aspect-[4/3]" />
                    <div className="p-4 space-y-2">
                      <div className="skeleton h-4 w-1/3 rounded" />
                      <div className="skeleton h-5 w-4/5 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                      <div className="skeleton h-6 w-2/5 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="py-24 text-center">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <h3 className="text-xl font-serif font-bold text-foreground mb-2">No listings found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your filters or search</p>
                <Button onClick={clearFilters} variant="outline">Clear all filters</Button>
              </div>
            ) : (
              <div className={cn(
                "grid gap-5",
                viewMode === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid-cols-1"
              )}>
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onSave={handleSave}
                    isSaved={savedIds.has(listing.id)}
                  />
                ))}
              </div>
            )}

            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <Button variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default function ListingsClient(props: ListingsClientProps = {}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ListingsContent {...props} />
    </Suspense>
  );
}
