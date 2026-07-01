import type { Metadata } from "next";
import BlogEditor from "@/components/features/BlogEditor";

export const metadata: Metadata = {
  title: "New Blog Post",
  robots: { index: false, follow: false },
};

export default function NewBlogPostPage() {
  return <BlogEditor mode="create" />;
}
