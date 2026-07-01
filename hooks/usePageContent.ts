/**
 * hooks/usePageContent.ts
 *
 * Routes all D1 access through the pageContent service layer.
 * No longer imports any database functions directly.
 */

"use client";

import { useEffect, useState } from "react";
import { getPageContent } from "@/services/pageContent";

export interface PageContentState {
  html: string;
  isCustom: boolean;
  loading: boolean;
  error: string | null;
}

export function usePageContent(
  slug: string,
  defaultHtml: string
): PageContentState {
  const [state, setState] = useState<PageContentState>({
    html: defaultHtml,
    isCustom: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const html = await getPageContent(slug);
        if (cancelled) return;

        if (html) {
          setState({ html, isCustom: true, loading: false, error: null });
        } else {
          setState({ html: defaultHtml, isCustom: false, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ html: defaultHtml, isCustom: false, loading: false, error: String(err) });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [slug, defaultHtml]);

  return state;
}
