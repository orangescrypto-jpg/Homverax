import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BlogListClient from "./BlogListClient";
import { APP_NAME } from "@/lib/constants";
import { getPlatformConfig } from "@/services/platformSettings";

export const metadata: Metadata = {
  title: "Blog — Nigerian Marketplace Insights",
  description: `Expert tips, market news, and guides for Nigerian buyers, sellers, artisans, and agents — covering property, products, and services. Powered by ${APP_NAME}.`,
  openGraph: {
    title: `${APP_NAME} Blog — Nigerian Marketplace Insights`,
    description: "Market news, buyer guides, agent tips, and marketplace insights across property, products, and services in Nigeria.",
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
