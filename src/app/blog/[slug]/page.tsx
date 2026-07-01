import type { Metadata } from "next";
import { getBlogPostBySlug } from "@/services/blog";
import { APP_NAME, APP_URL } from "@/lib/constants";
import BlogPostClient from "./BlogPostClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getBlogPostBySlug(slug);
    if (!post) return { title: "Article Not Found" };

    return {
      title: post.title,
      description: post.excerpt,
      keywords: post.tags,
      authors: [{ name: post.authorName }],
      openGraph: {
        title: post.title,
        description: post.excerpt,
        type: "article",
        publishedTime: post.publishedAt,
        authors: [post.authorName],
        images: post.coverImage
          ? [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }]
          : [],
        url: `${APP_URL}/blog/${post.slug}`,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description: post.excerpt,
        images: post.coverImage ? [post.coverImage] : [],
      },
      alternates: { canonical: `${APP_URL}/blog/${post.slug}` },
    };
  } catch {
    return { title: `Blog | ${APP_NAME}` };
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  return <BlogPostClient slug={slug} />;
}
