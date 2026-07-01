/**
 * services/pageContent.ts — backed by Cloudflare D1.
 * Same signatures as Firestore version.
 */
import { d1Query, d1Exec } from "@/lib/d1";

export interface PageContentDoc {
  html: string;
  updatedAt?: string;
}

export async function getPageContent(slug: string): Promise<string | null> {
  const rows = await d1Query<{ content: string }>(
    "SELECT content FROM page_content WHERE slug = ?",
    [slug]
  );
  if (!rows.length) return null;
  try {
    const parsed = JSON.parse(rows[0].content) as PageContentDoc;
    return parsed.html ?? null;
  } catch {
    return rows[0].content;
  }
}

export async function savePageContent(slug: string, html: string): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    `INSERT INTO page_content (slug, content, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    [slug, JSON.stringify({ html, updatedAt: now }), now]
  );
}

export async function resetPageContent(slug: string): Promise<void> {
  await d1Exec("DELETE FROM page_content WHERE slug = ?", [slug]);
}
