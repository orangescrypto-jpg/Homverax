"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight, BadgeCheck, Building2, ChevronRight,
  Clock, Home as HomeIcon, Lock, MapPin,
  MessageSquare, Search, Shield, ShieldCheck, Star,
  TrendingUp, Wrench, Zap, Flame, Rocket, Sofa,
  Bath, Bed, Eye, CheckCircle2,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
// ✅ FIX: HomeClient.tsx used to define its own separate, duplicate
// ListingCard function below (unrelated to the shared component used by
// the /listings browse page). That's why fixes to the shared card — like
// the "Escrow Protected" badge — never showed up on the homepage: this
// file was rendering a completely different, un-fixed copy. Now using the
// single shared component everywhere, so future fixes only need to
// happen in one place.
import SharedListingCard from "@/components/features/ListingCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { getPublishedPosts } from "@/services/blog";
import { searchListings } from "@/services/listings";
import { BLOG_CATEGORY_COLORS, getCategoryLabel } from "@/lib/blogConstants";
import { cn, formatPriceLabel, formatCurrencyShort } from "@/lib/utils";
// ✅ FIX: All stats + testimonials + upload limits from service layer
import { fetchPlatformStats } from "@/services/platformStats";
import { getPlatformConfig, DEFAULT_HOMEPAGE_STATS, DEFAULT_TESTIMONIALS, DEFAULT_HOMEPAGE_CTA } from "@/services/platformSettings";
import type { HomepageStat, HomepageCTA, Testimonial } from "@/services/platformSettings";
import type { BlogPost } from "@/types/blog";
import type { PropertyListing } from "@/types";

// ─── Static data ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: "Housing",             icon: HomeIcon,    query: "/listings?category=housing",             color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/40" },
  { label: "Land",                icon: MapPin,      query: "/listings?category=land",                color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/40" },
  { label: "Short Stays",         icon: Star,        query: "/listings?category=shortlets",           color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/40" },
  { label: "Furniture & Home",    icon: Sofa,        query: "/listings?category=furniture_home",      color: "text-pink-500",   bg: "bg-pink-50 dark:bg-pink-950/40" },
  { label: "Building Materials",  icon: ShieldCheck, query: "/listings?category=building_materials",  color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/40" },
  { label: "Artisans & Repairs",  icon: Wrench,      query: "/listings?category=artisans_repair",     color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/40" },
  { label: "Solar & Power",       icon: Zap,         query: "/listings?category=solar_power",         color: "text-cyan-500",   bg: "bg-cyan-50 dark:bg-cyan-950/40" },
  { label: "Home Services",       icon: Zap,         query: "/listings?category=home_service",        color: "text-teal-500",   bg: "bg-teal-50 dark:bg-teal-950/40" },
  { label: "Food & Grocery",      icon: Sofa,        query: "/listings?category=food_grocery",        color: "text-lime-600",   bg: "bg-lime-50 dark:bg-lime-950/40" },
  { label: "Cleaning & Household",icon: Sofa,        query: "/listings?category=cleaning_household",  color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Browse & Discover",    description: "Search thousands of verified listings across Nigeria. Filter by location, price, type, and more." },
  { step: "02", title: "Connect Safely",        description: "Chat directly with BVN-verified agents. Ask questions, schedule viewings, and negotiate terms." },
  { step: "03", title: "Pay with Escrow",       description: "Your payment is held securely until you confirm everything is right. Inspect the property, product, or service first." },
  { step: "04", title: "Move In Confidently",   description: "Release funds when satisfied. Full transaction history and receipts provided." },
];

// ✅ Testimonials now loaded from admin settings (see state below)
// Default fallback matches the original hardcoded list

const BOOST_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  featured:      { label: "Featured",   icon: Star,   color: "bg-accent text-accent-foreground" },
  top_placement: { label: "Top Pick",   icon: Rocket, color: "bg-primary text-primary-foreground" },
  urgent:        { label: "Urgent",     icon: Flame,  color: "bg-red-500 text-white" },
};

const PLACEHOLDER_IMGS = [
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=70",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=70",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=70",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=70",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=70",
];

// ✅ FIX: Stats now come from service layer
const fetchLiveStats = fetchPlatformStats;

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeClient() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("all");

  // Live stats
  const [stats, setStats] = useState({
    activeListings: 0,
    totalUsers: 0,
    verifiedAgents: 0,
    escrowTotal: 0,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Listings
  const [featuredListings, setFeaturedListings] = useState<PropertyListing[]>([]);
  const [categoryListings, setCategoryListings] = useState<Record<string, PropertyListing[]>>({});
  const [listingsLoading, setListingsLoading] = useState(true);

  // Blog
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([]);
  const [blogSlide, setBlogSlide] = useState(0);

  // ✅ Admin-configurable testimonials + homepage stat overrides + CTA
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [homepageStats, setHomepageStats] = useState<HomepageStat[]>(DEFAULT_HOMEPAGE_STATS);
  const [homepageCTA, setHomepageCTA] = useState<HomepageCTA>(DEFAULT_HOMEPAGE_CTA);

  useEffect(() => {
    // ✅ Load admin config first (testimonials + stat overrides)
    getPlatformConfig().then((cfg) => {
      if (cfg.testimonials?.length) setTestimonials(cfg.testimonials.filter((t) => t.visible));
      if (cfg.homepageStats?.length) setHomepageStats(cfg.homepageStats);
      if (cfg.homepageCTA) setHomepageCTA({ ...DEFAULT_HOMEPAGE_CTA, ...cfg.homepageCTA });
    }).catch(() => {});

    // Fetch live stats
    fetchLiveStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setStatsLoaded(true));

    // Fetch featured + per-category listings (4 per category)
    async function loadListings() {
      try {
        const CATS = ["housing","land","shortlets","furniture_home","building_materials","artisans_repair","solar_power","home_service","food_grocery","cleaning_household"];
        // ✅ FIX: this fires 9 concurrent requests (1 featured + 8 per
        // category). Promise.all() rejects the WHOLE batch if even one of
        // those 9 fails or times out — wiping out every category's
        // results, including ones that actually succeeded, and silently
        // landing in the catch block below. A single flaky request made
        // the entire "Latest Properties" section disappear. allSettled
        // keeps whatever succeeded instead of discarding everything.
        const [featuredResult, ...catResults] = await Promise.allSettled([
          searchListings({ boostType: "featured", limit: 3 } as any),
          ...CATS.map(cat => searchListings({ category: cat as any, limit: 4 } as any)),
        ]);
        const featuredData = featuredResult.status === "fulfilled" ? featuredResult.value.data : [];
        setFeaturedListings(featuredData);
        const featuredIds = new Set(featuredData.map((l: any) => l.id));
        const grouped: Record<string, PropertyListing[]> = {};
        CATS.forEach((cat, i) => {
          const result = catResults[i];
          const data = result.status === "fulfilled" ? result.value.data : [];
          grouped[cat] = data.filter((l: any) => !featuredIds.has(l.id)).slice(0, 4);
        });
        setCategoryListings(grouped);
      } catch {
        // fail silently
      } finally {
        setListingsLoading(false);
      }
    }
    loadListings();

    // Fetch blog posts
    getPublishedPosts({ limitCount: 4 })
      .then(setRecentPosts)
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (searchCategory !== "all") params.set("category", searchCategory);
    router.push(`/listings?${params.toString()}`);
  };

  // ✅ FIX: Admin controls stat cards — overrideValue takes precedence over live count
  const STAT_ICONS: Record<string, React.ElementType> = {
    activeListings: Building2,
    verifiedAgents: BadgeCheck,
    escrowTotal: Lock,
    happyClients: Star,
  };

  const STATS = homepageStats.map((statCfg) => {
    let value = "…";
    if (statCfg.useOverride && statCfg.overrideValue != null) {
      // Admin set a fixed override value (e.g. "7+", "500+", "₦50M+")
      value = String(statCfg.overrideValue);
    } else if (statsLoaded) {
      // Use live backend count
      if (statCfg.key === "activeListings") {
        value = stats.activeListings > 0 ? `${stats.activeListings.toLocaleString()}+` : "0";
      } else if (statCfg.key === "verifiedAgents") {
        value = stats.verifiedAgents > 0 ? `${stats.verifiedAgents.toLocaleString()}+` : "0";
      } else if (statCfg.key === "escrowTotal") {
        value = stats.escrowTotal > 0 ? formatCurrencyShort(stats.escrowTotal) : "₦0";
      } else if (statCfg.key === "happyClients") {
        value = stats.totalUsers > 0 ? `${stats.totalUsers.toLocaleString()}+` : "0";
      }
    }
    return {
      label: statCfg.label,
      value,
      icon: STAT_ICONS[statCfg.key] ?? Star,
    };
  });

  // Total count across all categories
  const totalListings = Object.values(categoryListings).reduce((s, arr) => s + arr.length, 0) + featuredListings.length;

  const CATEGORY_META: { key: string; label: string; color: string; bg: string }[] = [
    { key: "housing",             label: "Housing",              color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/40" },
    { key: "land",                label: "Land",                 color: "text-green-600",   bg: "bg-green-50 dark:bg-green-950/40" },
    { key: "shortlets",           label: "Short Stays",          color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/40" },
    { key: "furniture_home",      label: "Furniture & Home",     color: "text-pink-500",    bg: "bg-pink-50 dark:bg-pink-950/40" },
    { key: "building_materials",  label: "Building Materials",   color: "text-red-500",     bg: "bg-red-50 dark:bg-red-950/40" },
    { key: "artisans_repair",     label: "Artisans & Repairs",   color: "text-orange-500",  bg: "bg-orange-50 dark:bg-orange-950/40" },
    { key: "solar_power",         label: "Solar & Power",        color: "text-cyan-500",    bg: "bg-cyan-50 dark:bg-cyan-950/40" },
    { key: "home_service",        label: "Home Services",        color: "text-teal-500",    bg: "bg-teal-50 dark:bg-teal-950/40" },
    { key: "food_grocery",        label: "Food & Grocery",       color: "text-lime-600",    bg: "bg-lime-50 dark:bg-lime-950/40" },
    { key: "cleaning_household",  label: "Cleaning & Household", color: "text-indigo-500",  bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-40 right-0 h-[300px] w-[400px] rounded-full bg-accent/10 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
              <span className="badge-verified"><BadgeCheck className="h-3 w-3" /> BVN Verified Agents</span>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <Lock className="h-3 w-3 mr-1" /> Escrow Protected
              </Badge>
              <Badge className="bg-accent/20 text-accent-foreground border-accent/30">
                <Star className="h-3 w-3 mr-1" /> Nigeria #1 Marketplace
              </Badge>
            </div>

            <h1 className="font-serif text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Find Your Perfect{" "}
              <span className="text-primary">Property, Product or Service</span>{" "}
              in Nigeria
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              HomveraX connects you to verified agents, sellers and artisans, holds your payments
              securely in escrow, and ensures every deal is transparent. No scams, no guesswork.
            </p>

            {/* Search bar */}
            <div className="mt-10 flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
              <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
                <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search properties, products, services…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <select
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value)}
                className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="housing">Housing</option>
                <option value="land">Land</option>
                <option value="shortlets">Short Stays</option>
                <option value="furniture_home">Furniture & Home</option>
                <option value="building_materials">Building Materials</option>
                <option value="artisans_repair">Artisans & Repairs</option>
                <option value="solar_power">Solar & Power</option>
                <option value="home_service">Home Services</option>
                <option value="food_grocery">Food & Grocery</option>
                <option value="cleaning_household">Cleaning & Household</option>
              </select>
              <Button onClick={handleSearch} size="lg" className="rounded-xl font-semibold">
                Search
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Popular:</span>
              {["Lagos", "Abuja", "Apartments", "Land"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-primary/10 hover:text-primary transition-colors text-xs font-medium"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Live Stats */}
          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-card rounded-2xl border border-border p-5 text-center">
                  <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className={cn(
                    "text-2xl font-serif font-bold text-foreground transition-all",
                    !statsLoaded && "animate-pulse text-muted-foreground"
                  )}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Browse by Category ─────────────────────────────────────────── */}
      <section className="py-16 bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl font-bold text-foreground">Browse by Category</h2>
            <p className="mt-2 text-muted-foreground">Find exactly what you're looking for</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.label}
                  href={cat.query}
                  className="bg-card rounded-2xl border border-border p-5 text-center hover:border-primary/40 hover:shadow-md transition-all group"
                >
                  <div className={`w-12 h-12 rounded-xl ${cat.bg} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 ${cat.color}`} />
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{cat.label}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Listings Section ───────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Featured Listings (if any) */}
          {!listingsLoading && featuredListings.length > 0 && (
            <div className="mb-14">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1.5">
                    ★ Sponsored Placements
                  </p>
                  <h2 className="font-serif text-3xl font-bold text-foreground">Featured Properties</h2>
                  <p className="text-muted-foreground mt-1">
                    Hand-picked listings from verified agents
                  </p>
                </div>
                <Link href="/listings?boostType=featured" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* ✅ FIX: was grid-cols-1 on mobile (single column, stacked
                  cards) — now 2 columns on mobile, matching the category
                  grid below and the requested 2-cards-side-by-side layout. */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {featuredListings.map((listing) => (
                  <SharedListingCard key={listing.id} listing={listing} featured />
                ))}
              </div>
            </div>
          )}

          {/* Featured skeleton */}
          {listingsLoading && (
            <div className="mb-14">
              <div className="skeleton h-8 w-48 rounded mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <ListingSkeleton key={i} />)}
              </div>
            </div>
          )}

          {/* Category-grouped listings */}
          <div>
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1.5">
                  Live on HomveraX
                </p>
                <h2 className="font-serif text-3xl font-bold text-foreground">
                  Latest Properties & Services
                </h2>
                <p className="text-muted-foreground mt-1">
                  {listingsLoading ? "Loading listings…" : `${totalListings} listing${totalListings !== 1 ? "s" : ""} available right now`}
                </p>
              </div>
            </div>

            {listingsLoading ? (
              <div className="space-y-10">
                {[...Array(3)].map((_, s) => (
                  <div key={s}>
                    <div className="skeleton h-7 w-40 rounded mb-4" />
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, i) => <ListingSkeleton key={i} />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : totalListings === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <Building2 className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
                <h3 className="text-xl font-serif font-bold text-foreground mb-2">No listings yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Be the first to post a listing on HomveraX!
                </p>
                <Link href={isAuthenticated ? "/dashboard/listings/new" : "/register"}>
                  <Button className="gap-2">
                    <Building2 className="w-4 h-4" /> Create a Listing
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-12">
                {CATEGORY_META.filter(cat => (categoryListings[cat.key] ?? []).length > 0).map(cat => (
                  <div key={cat.key}>
                    {/* Category header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${cat.bg} ${cat.color}`}>
                          {cat.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {categoryListings[cat.key].length} listing{categoryListings[cat.key].length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <Link href={`/listings?category=${cat.key}`}
                        className={`text-xs font-semibold ${cat.color} flex items-center gap-1 hover:underline`}>
                        See all <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    {/* Listings grid — 2 cols mobile, 4 cols desktop */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {categoryListings[cat.key].map(listing => (
                        <SharedListingCard key={listing.id} listing={listing} />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Browse All button */}
                <div className="mt-4 text-center">
                  <Link href="/listings">
                    <Button size="lg" variant="outline" className="gap-2 px-10 rounded-xl font-semibold border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all">
                      Browse All Listings <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-3">
                    Showing {totalListings} of {stats.activeListings.toLocaleString()}+ active listings
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl font-bold text-foreground">How HomveraX Works</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Four simple steps from search to secure completion
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border z-0" />
                )}
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-xl font-serif font-bold text-primary">{step.step}</span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl font-bold text-foreground">What Our Users Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Blog Posts Slider ───────────────────────────────────────────── */}
      {recentPosts.length > 0 && (
        <section className="py-20 bg-secondary/30 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                  From the Blog
                </p>
                <h2 className="font-serif text-3xl font-bold text-foreground">
                  Nigerian Real Estate Insights
                </h2>
                <p className="text-muted-foreground mt-2">
                  Tips, market trends, and guides to help you transact confidently.
                </p>
              </div>
              <Link href="/blog" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline shrink-0">
                View all articles <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Slider */}
            <div className="relative">
              <div
                className="flex gap-5 transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(calc(-${blogSlide * 100}% - ${blogSlide * 20}px))` }}
              >
                {recentPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group relative bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200 shrink-0 w-full sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)]"
                  >
                    <div className="relative h-48 overflow-hidden bg-secondary">
                      {post.coverImage ? (
                        <Image
                          src={post.coverImage}
                          alt={post.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                          <Building2 className="w-10 h-10 text-primary/30" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm", BLOG_CATEGORY_COLORS[post.category])}>
                          {getCategoryLabel(post.category)}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-serif font-bold text-foreground text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-2">
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{post.excerpt}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {post.readingTimeMinutes} min read
                        </span>
                        <span>
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
                            : ""}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {recentPosts.length > 1 && (
                <>
                  <button
                    onClick={() => setBlogSlide((s) => Math.max(0, s - 1))}
                    disabled={blogSlide === 0}
                    className={cn("absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center transition-all",
                      blogSlide === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-primary hover:text-primary-foreground hover:border-primary"
                    )}
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <button
                    onClick={() => setBlogSlide((s) => Math.min(recentPosts.length - 1, s + 1))}
                    disabled={blogSlide >= recentPosts.length - 1}
                    className={cn("absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center transition-all",
                      blogSlide >= recentPosts.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-primary hover:text-primary-foreground hover:border-primary"
                    )}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {recentPosts.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {recentPosts.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setBlogSlide(i)}
                    className={cn("rounded-full transition-all duration-300",
                      blogSlide === i ? "w-6 h-2.5 bg-primary" : "w-2.5 h-2.5 bg-border hover:bg-primary/40"
                    )}
                  />
                ))}
              </div>
            )}

            <div className="text-center mt-8 sm:hidden">
              <Link href="/blog">
                <Button variant="outline" className="gap-2">View all articles <ChevronRight className="w-4 h-4" /></Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-4">
            {homepageCTA.headline}
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Join over{" "}
            {homepageCTA.useUserCountOverride
              ? homepageCTA.userCountOverride
              : statsLoaded && stats.totalUsers > 0
              ? `${stats.totalUsers.toLocaleString()}+`
              : "0"}
            {" "}{homepageCTA.subtext}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl font-semibold">
                  Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl font-semibold">
                    Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/listings">
                  <Button size="lg" className="border-2 border-white bg-transparent text-white hover:bg-white hover:text-primary rounded-xl font-semibold transition-all">
                    Browse Listings
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function ListingSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border">
      <div className="skeleton aspect-[4/3]" />
      <div className="p-3.5 space-y-2">
        <div className="skeleton h-3 w-1/4 rounded" />
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-5 w-2/5 rounded mt-3" />
      </div>
    </div>
  );
}
