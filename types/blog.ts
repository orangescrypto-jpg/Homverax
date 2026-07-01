// ─── Blog ─────────────────────────────────────────────────────────────────────
// Appended to src/types/index.ts

export type BlogStatus = "draft" | "published" | "archived";

export type BlogCategory =
  | "market-news"
  | "tips-for-buyers"
  | "tips-for-sellers"
  | "agent-guide"
  | "escrow-guide"
  | "nigerian-cities"
  | "property-law"
  | "platform-updates"
  | "services";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // rich text / markdown
  coverImage?: string;
  category: BlogCategory;
  tags: string[];
  status: BlogStatus;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole: string; // "Admin" | "Moderator"
  readingTimeMinutes: number;
  viewsCount: number;
  featured: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
