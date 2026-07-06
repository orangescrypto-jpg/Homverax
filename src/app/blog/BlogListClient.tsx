"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Calendar, Clock, Search, Star, X } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getPublishedPosts } from "@/services/blog";
import { BLOG_CATEGORIES, BLOG_CATEGORY_COLORS, getCategoryLabel } from "@/lib/blogConstants";
import { timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BlogPost, BlogCategory } from "@/types/blog";

const PLACEHOLDER = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=70";

export default function BlogListClient() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [featured, setFeatured] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<BlogCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [all, feat] = await Promise.all([
          getPublishedPosts({ limitCount: 50 }),
          getPublishedPosts({ featured: true, limitCount: 3 }),
        ]);
        setPosts(all);
        setFeatured(feat);
      } catch (err) {
        console.error("Failed to load blog posts:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Failed to load blog posts: ${message}`);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filtered = posts.filter((p) => {
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <div className="bg-primary text-primary-foreground py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-1.5 mb-4">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium">HomveraX Blog</span>
          </div>
          <h1 className="text-4xl font-serif font-bold mb-3">
            Nigerian Marketplace Insights
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto">
            Expert tips, market trends, buyer guides, and product & service news — everything you need to navigate the Nigerian marketplace confidently.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Featured posts */}
        {!isLoading && featured.length > 0 && activeCategory === "all" && !searchQuery && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-accent" /> Featured Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {featured.map((post, i) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className={cn(
                    "group relative bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-all",
                    i === 0 && "md:col-span-2"
                  )}
                >
                  <div className={cn("relative overflow-hidden", i === 0 ? "h-52" : "h-40")}>
                    <Image
                      src={post.coverImage ?? PLACEHOLDER}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-lg",
                        BLOG_CATEGORY_COLORS[post.category]
                      )}>
                        {getCategoryLabel(post.category)}
                      </span>
                      <h3 className={cn(
                        "font-serif font-bold text-white mt-1 line-clamp-2",
                        i === 0 ? "text-lg" : "text-sm"
                      )}>
                        {post.title}
                      </h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search articles…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all",
              activeCategory === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            All
          </button>
          {BLOG_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all",
                activeCategory === cat.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Post grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-border">
                <div className="skeleton h-44" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-4 w-1/3 rounded" />
                  <div className="skeleton h-5 w-4/5 rounded" />
                  <div className="skeleton h-3 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border">
            <BookOpen className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">No articles found</h2>
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "Try a different search term" : "No posts in this category yet"}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {filtered.length} article{filtered.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="relative h-44 overflow-hidden">
                    <Image
                      src={post.coverImage ?? PLACEHOLDER}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div className="p-4">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg", BLOG_CATEGORY_COLORS[post.category])}>
                      {getCategoryLabel(post.category)}
                    </span>
                    <h3 className="font-serif font-bold text-foreground text-base mt-2 mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.excerpt}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.publishedAt ? timeAgo(post.publishedAt) : "Draft"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readingTimeMinutes} min read
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
