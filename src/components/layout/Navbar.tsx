"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell, Building2, ChevronDown, LayoutDashboard,
  LogOut, Menu, MessageSquare, Moon, Settings, Shield, Sun, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { logoutUser } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
// ✅ FIX: Load feature flags to conditionally show Blog link
import { getPlatformConfig } from "@/services/platformSettings";

export default function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const { logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // ✅ Feature flags
  const [showBlog, setShowBlog] = useState(false);
  const [showRentals, setShowRentals] = useState(false);

  useEffect(() => {
    getPlatformConfig().then((cfg) => {
      setShowBlog(cfg.features.enableBlogSection !== false);
      setShowRentals(cfg.features.enableRentalsPage === true);
    }).catch(() => setShowBlog(true)); // fail open
  }, []);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const handleLogout = async () => {
    try {
      await logoutUser();
      logout();
      router.push("/");
      toast.success("Signed out successfully");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[var(--sidebar)]/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-serif font-semibold text-foreground">
              Homvera<span className="text-accent font-bold">X</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/listings">
              <Button variant="ghost" size="sm" className={cn(isActive("/listings") ? "bg-secondary text-primary font-medium" : "text-muted-foreground hover:text-foreground")}>
                Browse
              </Button>
            </Link>

            {/* Rentals link — shown when enableRentalsPage = true */}
            {showRentals && (
              <Link href="/rentals">
                <Button variant="ghost" size="sm" className={cn(isActive("/rentals") ? "bg-secondary text-primary font-medium" : "text-muted-foreground hover:text-foreground")}>
                  Rentals
                </Button>
              </Link>
            )}

            {/* ✅ FIX: Only shown when enableBlogSection = true */}
            {showBlog && (
              <Link href="/blog">
                <Button variant="ghost" size="sm" className={cn(isActive("/blog") ? "bg-secondary text-primary font-medium" : "text-muted-foreground hover:text-foreground")}>
                  Blog
                </Button>
              </Link>
            )}

            <Link href="/#how-it-works">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                How It Works
              </Button>
            </Link>
            <Link href="/#pricing">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Pricing
              </Button>
            </Link>
          </div>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {isAuthenticated && user ? (
              <>
                <Link href="/messages">
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 px-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
                        {user.firstName || user.name}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-semibold truncate">{user.name}</span>
                        <span className="text-xs font-normal text-muted-foreground truncate">
                          {user.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
                      <Settings className="mr-2 h-4 w-4" /> Settings
                    </DropdownMenuItem>
                    {user.role === "admin" && (
                      <DropdownMenuItem onClick={() => router.push("/admin")}>
                        <Shield className="mr-2 h-4 w-4" /> Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-1">
          <Link href="/listings" onClick={() => setMobileOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            Browse Listings
          </Link>
          {showRentals && (
            <Link href="/rentals" onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              Rentals
            </Link>
          )}
          {/* ✅ FIX: Blog link hidden on mobile too when flag is off */}
          {showBlog && (
            <Link href="/blog" onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              Blog
            </Link>
          )}
          <Link href="/#how-it-works" onClick={() => setMobileOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            How It Works
          </Link>
          <Link href="/#pricing" onClick={() => setMobileOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            Pricing
          </Link>

          {isAuthenticated ? (
            <div className="pt-2 border-t border-border mt-2">
              <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full mb-2">Dashboard</Button>
              </Link>
              <Button variant="ghost" className="w-full text-destructive" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          ) : (
            <div className="pt-2 border-t border-border mt-2 flex flex-col gap-2">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full">Sign In</Button>
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}>
                <Button className="w-full">Get Started</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
