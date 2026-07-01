"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, Calendar, CheckCircle2,
  Clock, Edit2, Eye, Share2, Tag,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getBlogPostBySlug } from "@/services/blog";
import { getPublishedPosts } from "@/services/blog";
import { BLOG_CATEGORY_COLORS, getCategoryLabel } from "@/lib/blogConstants";
import { cn, timeAgo } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isAdminOrModerator } from "@/lib/roles";
import { toast } from "sonner";
import type { BlogPost } from "@/types/blog";

const PLACEHOLDER = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80";

/**
 * Renders blog content intelligently.
 * If the content contains HTML tags, renders as HTML.
 * Otherwise falls back to markdown-style rendering.
 */
function BlogContent({ content }: { content: string }) {
  const isHTML = /<[a-z][\s\S]*>/i.test(content);

  if (isHTML) {
    return (
      <div
        className="prose prose-lg max-w-none text-foreground
          [&_h2]:text-2xl [&_h2]:font-serif [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-4
          [&_h3]:text-xl [&_h3]:font-serif [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-3
          [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-4
          [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:text-muted-foreground [&_ul]:mb-4 [&_ul_li]:mb-1.5
          [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:text-muted-foreground [&_ol]:mb-4 [&_ol_li]:mb-1.5
          [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:mb-4
          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
          [&_hr]:border-border [&_hr]:my-8
          [&_strong]:font-semibold [&_strong]:text-foreground
          [&_em]:italic [&_em]:text-muted-foreground
          [&_img]:rounded-2xl [&_img]:max-w-full [&_img]:my-6 [&_img]:shadow-sm
          [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
          [&_pre]:bg-secondary [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:mb-4"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Markdown fallback renderer
  const lines = content.split("\n");
  return (
    <div className="prose prose-lg max-w-none text-foreground">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} className="text-2xl font-serif font-bold text-foreground mt-8 mb-4">{line.replace("## ", "")}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-xl font-serif font-semibold text-foreground mt-6 mb-3">{line.replace("### ", "")}</h3>;
        if (line.startsWith("> ")) return <blockquote key={i} className="border-l-4 border-primary pl-5 italic text-muted-foreground mb-4">{line.replace("> ", "")}</blockquote>;
        if (line.startsWith("- ")) return (
          <li key={i} className="ml-6 mb-2 text-muted-foreground flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>{line.replace("- ", "")}</span>
          </li>
        );
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-foreground mb-3">{line.replace(/\*\*/g, "")}</p>;
        if (line === "---") return <hr key={i} className="border-border my-8" />;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-muted-foreground leading-relaxed mb-4">{line}</p>;
      })}
    </div>
  );
}

export default function BlogPostClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const canEdit = user && isAdminOrModerator(user.role);

  useEffect(() => {
    async function load() {
      try {
        const data = await getBlogPostBySlug(slug);
        if (!data) {
          router.push("/blog");
          return;
        }
        setPost(data);

        // Related posts are a non-critical enhancement — if this fails,
        // the article itself should still render fine.
        try {
          const related = await getPublishedPosts({ category: data.category, limitCount: 4 });
          setRelatedPosts(related.filter((p) => p.id !== data.id).slice(0, 3));
        } catch (err) {
          console.error("Failed to load related posts:", err);
        }
      } catch (err) {
        console.error("Failed to load article:", err);
        toast.error("Failed to load article");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [slug, router]);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: post?.title, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    }
  };

  // JSON-LD structured data for SEO
  const structuredData = post
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        image: post.coverImage,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        author: { "@type": "Person", name: post.authorName },
        publisher: { "@type": "Organization", name: "HomveraX", url: "https://homverax.com" },
        keywords: post.tags.join(", "),
      })
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <div className="skeleton h-10 w-3/4 rounded" />
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-5/6 rounded" />
          <div className="skeleton h-4 w-full rounded" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* JSON-LD structured data */}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
      )}

      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link
          href="/blog"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>

        {/* Category */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-lg", BLOG_CATEGORY_COLORS[post.category])}>
            {getCategoryLabel(post.category)}
          </span>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5 text-muted-foreground">
              <Share2 className="w-4 h-4" /> Share
            </Button>
            {canEdit && (
              <Link href={`/admin/blog/edit/${post.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Edit2 className="w-4 h-4" /> Edit Post
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-serif font-extrabold text-foreground leading-tight mb-4">
          {post.title}
        </h1>

        {/* Excerpt */}
        <p className="text-lg text-muted-foreground leading-relaxed mb-6">{post.excerpt}</p>

        {/* Meta */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                {post.authorName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{post.authorName}</p>
              <p className="text-xs text-muted-foreground">{post.authorRole}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-NG", { dateStyle: "medium" }) : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {post.readingTimeMinutes} min read
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {post.viewsCount.toLocaleString()} views
            </span>
          </div>
        </div>

        {/* Cover image */}
        {post.coverImage && (
          <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden mb-8">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 720px"
            />
          </div>
        )}

        {/* Content */}
        <article className="mb-8">
          <BlogContent content={post.content} />
        </article>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-8 pt-6 border-t border-border">
            <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="pt-8 border-t border-border">
            <h3 className="text-lg font-serif font-bold text-foreground mb-4">Related Articles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedPosts.map((related) => (
                <Link
                  key={related.id}
                  href={`/blog/${related.slug}`}
                  className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="relative h-28 overflow-hidden">
                    <Image
                      src={related.coverImage ?? PLACEHOLDER}
                      alt={related.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="240px"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {related.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {related.readingTimeMinutes} min read
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
