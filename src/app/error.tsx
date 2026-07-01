"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-muted-foreground text-sm mb-8">
          An unexpected error occurred. Please try again or go back to the home page.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Try Again
          </Button>
          <Button onClick={() => router.push("/")} className="gap-2">
            <Home className="w-4 h-4" /> Go Home
          </Button>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-muted-foreground/60">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
