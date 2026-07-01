import type { BlogCategory } from "@/types/blog";

export const BLOG_CATEGORIES: { value: BlogCategory; label: string; description: string }[] = [
  { value: "market-news",      label: "Market News",          description: "Nigerian real estate market trends and updates" },
  { value: "tips-for-buyers",  label: "Tips for Buyers",      description: "Guides for tenants and property buyers" },
  { value: "tips-for-sellers", label: "Tips for Sellers",     description: "How to sell or rent out faster" },
  { value: "agent-guide",      label: "Agent Guide",          description: "Resources for real estate agents" },
  { value: "escrow-guide",     label: "Escrow Guide",         description: "How escrow works and payment safety" },
  { value: "nigerian-cities",  label: "Nigerian Cities",      description: "Property guides for Lagos, Abuja, PH, etc." },
  { value: "property-law",     label: "Property Law",         description: "Legal aspects of Nigerian real estate" },
  { value: "platform-updates", label: "Platform Updates",     description: "HomveraX features and announcements" },
  { value: "services",         label: "Services",             description: "Cleaning, repairs, and home services" },
];

export function getCategoryLabel(value: BlogCategory): string {
  return BLOG_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const BLOG_CATEGORY_COLORS: Record<BlogCategory, string> = {
  "market-news":      "bg-blue-100 text-blue-700",
  "tips-for-buyers":  "bg-green-100 text-green-700",
  "tips-for-sellers": "bg-purple-100 text-purple-700",
  "agent-guide":      "bg-orange-100 text-orange-700",
  "escrow-guide":     "bg-primary/10 text-primary",
  "nigerian-cities":  "bg-yellow-100 text-yellow-700",
  "property-law":     "bg-red-100 text-red-700",
  "platform-updates": "bg-indigo-100 text-indigo-700",
  "services":         "bg-teal-100 text-teal-700",
};
