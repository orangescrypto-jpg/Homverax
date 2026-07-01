import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/constants";
import { d1Query } from "@/lib/d1";

/**
 * sitemap.ts — Auto-generated at /sitemap.xml
 * Dynamic listing and blog post URLs fetched from Cloudflare D1.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: APP_URL,                            lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${APP_URL}/listings`,              lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${APP_URL}/find-property`,         lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/blog`,                  lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${APP_URL}/about`,                 lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/contact`,               lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/register`,              lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/login`,                 lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/terms`,                 lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${APP_URL}/privacy`,               lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${APP_URL}/cookies`,               lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${APP_URL}/escrow-agreement`,      lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];

  let listingPages: MetadataRoute.Sitemap = [];
  try {
    const rows = await d1Query<{ id: string; updated_at: string }>(
      "SELECT id, updated_at FROM listings WHERE status = 'active' ORDER BY updated_at DESC LIMIT 5000",
      []
    );
    listingPages = rows.map((r) => ({
      url:             `${APP_URL}/listings/${r.id}`,
      lastModified:    new Date(r.updated_at),
      changeFrequency: "weekly" as const,
      priority:        0.7,
    }));
  } catch (err) {
    console.warn("sitemap: failed to fetch listings —", err);
  }

  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const rows = await d1Query<{ slug: string; updated_at: string }>(
      "SELECT slug, updated_at FROM blog_posts WHERE published = 1 ORDER BY published_at DESC LIMIT 500",
      []
    );
    blogPages = rows.map((r) => ({
      url:             `${APP_URL}/blog/${r.slug}`,
      lastModified:    new Date(r.updated_at),
      changeFrequency: "monthly" as const,
      priority:        0.6,
    }));
  } catch (err) {
    console.warn("sitemap: failed to fetch blog posts —", err);
  }

  return [...staticPages, ...listingPages, ...blogPages];
}
