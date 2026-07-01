"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import BlogEditor from "@/components/features/BlogEditor";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getBlogPostById } from "@/services/blog";
import { toast } from "sonner";
import type { BlogPost } from "@/types/blog";

export default function EditBlogPostClient({ id }: { id: string }) {
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getBlogPostById(id);
        if (!data) {
          toast.error("Post not found");
          router.push("/admin/blog");
          return;
        }
        setPost(data);
      } catch {
        toast.error("Failed to load post");
        router.push("/admin/blog");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id, router]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading post…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!post) return null;

  return <BlogEditor mode="edit" existingPost={post} />;
}
