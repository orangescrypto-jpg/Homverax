"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen, CheckCircle2, Edit2, Eye, Loader2,
  PlusCircle, Star, StarOff, Trash2, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  getAllBlogPosts, deleteBlogPost, toggleFeatured, updateBlogPost,
} from "@/services/blog";
import { BLOG_CATEGORY_COLORS, getCategoryLabel } from "@/lib/blogConstants";
import { useAuth } from "@/hooks/useAuth";
import { isAdminOrModerator } from "@/lib/roles";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { BlogPost, BlogStatus } from "@/types/blog";

const PLACEHOLDER = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&q=60";

const STATUS_CONFIG: Record<BlogStatus, { label: string; color: string }> = {
  published: { label: "Published", color: "bg-green-100 text-green-700" },
  draft:     { label: "Draft",     color: "bg-yellow-100 text-yellow-700" },
  archived:  { label: "Archived",  color: "bg-gray-100 text-gray-600" },
};

export default function AdminBlogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<BlogStatus | "all">("all");

  useEffect(() => {
    if (!user || !isAdminOrModerator(user.role)) {
      router.replace("/dashboard");
      return;
    }
    getAllBlogPosts()
      .then(setPosts)
      .catch(() => toast.error("Failed to load posts"))
      .finally(() => setIsLoading(false));
  }, [user, router]);

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this post? This cannot be undone.")) return;
    setActing(id);
    try {
      await deleteBlogPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Post deleted");
    } catch { toast.error("Failed to delete post"); }
    finally { setActing(null); }
  };

  const handleToggleFeatured = async (post: BlogPost) => {
    setActing(post.id);
    try {
      await toggleFeatured(post.id, !post.featured);
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, featured: !p.featured } : p));
      toast.success(post.featured ? "Removed from featured" : "Marked as featured");
    } catch { toast.error("Failed to update"); }
    finally { setActing(null); }
  };

  const handleStatusChange = async (post: BlogPost, status: BlogStatus) => {
    setActing(post.id);
    try {
      await updateBlogPost(post.id, { status });
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, status } : p));
      toast.success(`Post ${status === "published" ? "published" : status === "draft" ? "moved to drafts" : "archived"}`);
    } catch { toast.error("Failed to update status"); }
    finally { setActing(null); }
  };

  const filtered = posts.filter((p) => filterStatus === "all" || p.status === filterStatus);

  const counts = {
    all: posts.length,
    published: posts.filter((p) => p.status === "published").length,
    draft: posts.filter((p) => p.status === "draft").length,
    archived: posts.filter((p) => p.status === "archived").length,
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Blog Posts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {counts.published} published · {counts.draft} draft · {counts.archived} archived
          </p>
        </div>
        <Link href="/admin/blog/new">
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" /> New Post
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-secondary/50 p-1 rounded-xl w-fit">
        {(["all", "published", "draft", "archived"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
              filterStatus === s
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
            <span className="ml-1.5 text-xs text-muted-foreground">({counts[s]})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <h2 className="text-lg font-serif font-bold text-foreground mb-2">No posts yet</h2>
          <p className="text-muted-foreground text-sm mb-4">Create your first blog post to get started</p>
          <Link href="/admin/blog/new">
            <Button size="sm" className="gap-2">
              <PlusCircle className="w-4 h-4" /> Create Post
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => {
            const statusCfg = STATUS_CONFIG[post.status];
            const isActing = acting === post.id;

            return (
              <div key={post.id} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4">
                {/* Cover thumbnail */}
                <div className="relative w-20 h-16 rounded-xl overflow-hidden shrink-0">
                  <Image
                    src={post.coverImage ?? PLACEHOLDER}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", statusCfg.color)}>
                      {statusCfg.label}
                    </span>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg", BLOG_CATEGORY_COLORS[post.category])}>
                      {getCategoryLabel(post.category)}
                    </span>
                    {post.featured && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-accent/20 text-accent-foreground flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Featured
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm truncate">{post.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{post.excerpt}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{post.authorName}</span>
                    <span>{timeAgo(post.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {post.viewsCount}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  {/* Publish / Unpublish */}
                  {post.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50"
                      disabled={isActing}
                      onClick={() => handleStatusChange(post, "published")}
                    >
                      {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Publish
                    </Button>
                  )}
                  {post.status === "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                      disabled={isActing}
                      onClick={() => handleStatusChange(post, "draft")}
                    >
                      {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Unpublish
                    </Button>
                  )}

                  {/* Featured toggle */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn("h-8 w-8 p-0", post.featured ? "text-accent" : "text-muted-foreground")}
                    disabled={isActing}
                    onClick={() => handleToggleFeatured(post)}
                    title={post.featured ? "Remove from featured" : "Mark as featured"}
                  >
                    {post.featured ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                  </Button>

                  {/* View */}
                  {post.status === "published" && (
                    <Link href={`/blog/${post.slug}`} target="_blank">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}

                  {/* Edit */}
                  <Link href={`/admin/blog/edit/${post.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </Link>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={isActing}
                    onClick={() => handleDelete(post.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
