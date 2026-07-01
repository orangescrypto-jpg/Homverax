import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BlogListClient from "./BlogListClient";
import { APP_NAME } from "@/lib/constants";
import { getPlatformConfig } from "@/services/platformSettings";

export const metadata: Metadata = {
  title: "Blog — Nigerian Real Estate Insights",
  description: `Expert tips, market news, and guides for Nigerian property buyers, sellers, and agents. Powered by ${APP_NAME}.`,
  openGraph: {
    title: `${APP_NAME} Blog — Nigerian Real Estate Insights`,
    description: "Market news, buyer guides, agent tips, and property law in Nigeria.",
  },
  alternates: { canonical: "https://homverax.com/blog" },
};

/**
 * ✅ FIX: Server-side feature flag gate.
 * If admin disables enableBlogSection, /blog redirects to home.
 */
export default async function BlogPage() {
  const config = await getPlatformConfig();
  if (!config.features.enableBlogSection) {
    redirect("/");
  }
  return <BlogListClient />;
}
