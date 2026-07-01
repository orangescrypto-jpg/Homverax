/**
 * components/PageContentRenderer.tsx
 * Client component that renders admin-editable page HTML from D1.
 * Shows a skeleton while loading, falls back to DEFAULT_HTML if no custom content.
 */

"use client";

import { usePageContent } from "@/hooks/usePageContent";

interface PageContentRendererProps {
  slug: string;
  defaultHtml: string;
}

export default function PageContentRenderer({ slug, defaultHtml }: PageContentRendererProps) {
  const { html, loading } = usePageContent(slug, defaultHtml);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 bg-secondary rounded w-full" style={{ width: `${80 + (i % 3) * 7}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="prose prose-lg max-w-none text-muted-foreground leading-relaxed"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
