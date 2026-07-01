import type { Metadata } from "next";
import EditBlogPostClient from "./EditBlogPostClient";

export const metadata: Metadata = {
  title: "Edit Blog Post",
  robots: { index: false, follow: false },
};

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditBlogPostClient id={id} />;
}
