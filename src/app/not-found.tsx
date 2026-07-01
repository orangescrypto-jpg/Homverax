import Link from "next/link";
import { Building2, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-primary opacity-50" />
          </div>
          <h1 className="text-6xl font-serif font-bold text-foreground mb-2">404</h1>
          <h2 className="text-xl font-semibold text-foreground mb-3">Page not found</h2>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or may have been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="gap-2 w-full sm:w-auto">
                <Home className="w-4 h-4" /> Go Home
              </Button>
            </Link>
            <Link href="/listings">
              <Button variant="outline" className="gap-2 w-full sm:w-auto">
                <Search className="w-4 h-4" /> Browse Listings
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
