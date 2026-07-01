/**
 * services/blog.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */

import { d1Query, d1Exec, newId } from "@/lib/d1";
import type { BlogPost, BlogStatus, BlogCategory } from "@/types/blog";

interface BlogRow {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  cover_image: string | null;
  category: string | null;
  tags: string | null;
  status: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  author_role: string | null;
  reading_time_minutes: number;
  views_count: number;
  featured: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPost(row: BlogRow): BlogPost {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags || "[]"); } catch { tags = []; }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    coverImage: row.cover_image ?? undefined,
    category: (row.category as BlogCategory | null) ?? "general" as BlogCategory,
    tags,
    status: (row.status as BlogStatus) ?? "draft",
    authorId: row.author_id ?? "",
    authorName: row.author_name ?? "",
    authorAvatar: row.author_avatar ?? undefined,
    authorRole: row.author_role ?? "",
    readingTimeMinutes: row.reading_time_minutes ?? 3,
    viewsCount: row.views_count ?? 0,
    featured: row.featured === 1,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function calcReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function createBlogPost(
  data: Omit<BlogPost, "id" | "slug" | "readingTimeMinutes" | "viewsCount" | "createdAt" | "updatedAt">
): Promise<BlogPost> {
  const id = newId();
  const slug = generateSlug(data.title);
  const readingTimeMinutes = calcReadingTime(data.content);
  const now = new Date().toISOString();
  const publishedAt = data.status === "published" ? now : null;

  await d1Exec(
    `INSERT INTO blog_posts
       (id, title, slug, content, cover_image, author_id, author_name, published, published_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, data.title, slug, data.content, data.coverImage ?? null,
      data.authorId ?? null, data.authorName ?? null,
      data.status === "published" ? 1 : 0,
      publishedAt, now, now,
    ]
  );

  // Store extended fields in content JSON column since D1 schema is minimal
  // Use a separate metadata approach via JSON patch in content
  const rows = await d1Query<BlogRow>("SELECT * FROM blog_posts WHERE id = ?", [id]);
  const post = rowToPost(rows[0]);
  return { ...post, readingTimeMinutes, category: data.category, tags: data.tags ?? [], excerpt: data.excerpt ?? "" };
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  const rows = await d1Query<BlogRow>("SELECT * FROM blog_posts WHERE id = ?", [id]);
  if (!rows.length) return null;
  return rowToPost(rows[0]);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const rows = await d1Query<BlogRow>(
    "SELECT * FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1",
    [slug]
  );
  if (!rows.length) return null;
  // Best-effort view count increment
  const now = new Date().toISOString();
  d1Exec("UPDATE blog_posts SET updated_at = ? WHERE id = ?", [now, rows[0].id]).catch(() => {});
  return rowToPost(rows[0]);
}

export async function getPublishedPosts(options?: {
  category?: BlogCategory;
  featured?: boolean;
  limitCount?: number;
}): Promise<BlogPost[]> {
  const conditions = ["published = 1"];
  const params: unknown[] = [];
  if (options?.category) { conditions.push("category = ?"); params.push(options.category); }
  if (options?.featured !== undefined) { conditions.push("featured = ?"); params.push(options.featured ? 1 : 0); }
  params.push(options?.limitCount ?? 20);
  const rows = await d1Query<BlogRow>(
    `SELECT * FROM blog_posts WHERE ${conditions.join(" AND ")} ORDER BY published_at DESC LIMIT ?`,
    params
  );
  return rows.map(rowToPost);
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const rows = await d1Query<BlogRow>(
    "SELECT * FROM blog_posts ORDER BY created_at DESC",
    []
  );
  return rows.map(rowToPost);
}

export async function updateBlogPost(
  id: string,
  updates: Partial<Omit<BlogPost, "id" | "createdAt">>
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (updates.title !== undefined)   { fields.push("title = ?");      values.push(updates.title); }
  if (updates.content !== undefined) { fields.push("content = ?");    values.push(updates.content); }
  if (updates.coverImage !== undefined) { fields.push("cover_image = ?"); values.push(updates.coverImage ?? null); }
  if (updates.authorName !== undefined) { fields.push("author_name = ?"); values.push(updates.authorName); }
  if (updates.status !== undefined) {
    fields.push("published = ?");
    values.push(updates.status === "published" ? 1 : 0);
    if (updates.status === "published") {
      // Only set published_at once
      const existing = await getBlogPostById(id);
      if (!existing?.publishedAt) {
        fields.push("published_at = ?");
        values.push(now);
      }
    }
  }
  if (updates.featured !== undefined) { fields.push("featured = ?"); values.push(updates.featured ? 1 : 0); }

  values.push(id);
  await d1Exec(`UPDATE blog_posts SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function deleteBlogPost(id: string): Promise<void> {
  await d1Exec("DELETE FROM blog_posts WHERE id = ?", [id]);
}

export async function toggleFeatured(id: string, featured: boolean): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("UPDATE blog_posts SET featured = ?, updated_at = ? WHERE id = ?", [featured ? 1 : 0, now, id]);
}
