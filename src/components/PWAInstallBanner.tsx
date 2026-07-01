"use client";

/**
 * components/PWAInstallBanner.tsx
 *
 * FIXES:
 * 1. Now actually shown — imported in layout.tsx and HomeClient.tsx
 * 2. Delayed appearance (3s) so it doesn't distract on page load
 * 3. Gated by enablePWA admin flag
 * 4. Dismissing hides for session, reappears on next visit
 * 5. Once installed, never shown again (localStorage flag)
 * 6. "Already installed" standalone mode — banner never shows
 */

import { useEffect, useState } from "react";
import { Building2, Download, X, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { cn } from "@/lib/utils";

interface PWAInstallBannerProps {
  /** Delay in ms before banner appears. Default 3000 */
  delay?: number;
  /** Position. Default "bottom" */
  position?: "bottom" | "top";
}

export default function PWAInstallBanner({
  delay = 3000,
  position = "bottom",
}: PWAInstallBannerProps) {
  const { isInstallable, install, dismiss } = usePWAInstall();
  const [visible, setVisible]   = useState(false);
  const [installing, setInstalling] = useState(false);
  const [leaving, setLeaving]   = useState(false);

  // ✅ Delay appearance so it doesn't distract on initial page load
  useEffect(() => {
    if (!isInstallable) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [isInstallable, delay]);

  if (!visible) return null;

  const handleInstall = async () => {
    setInstalling(true);
    await install();
    setInstalling(false);
    // usePWAInstall handles the outcome — if dismissed it sets sessionStorage
    setLeaving(true);
    setTimeout(() => setVisible(false), 300);
  };

  const handleDismiss = () => {
    dismiss();
    setLeaving(true);
    setTimeout(() => setVisible(false), 300);
  };

  return (
    <div className={cn(
      "fixed left-4 right-4 z-50 max-w-sm mx-auto",
      "transition-all duration-300",
      position === "bottom" ? "bottom-20 sm:bottom-6" : "top-20",
      leaving
        ? "opacity-0 translate-y-2"
        : "opacity-100 translate-y-0 animate-in slide-in-from-bottom-4 duration-300"
    )}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />

        <div className="p-4 flex items-center gap-3">
          {/* App icon */}
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">
              Install HomveraX
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Add to home screen for faster access to properties & escrow
            </p>
          </div>

          {/* Dismiss X */}
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0 -mt-8 -mr-1 self-start"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Install button — full width at bottom */}
        <div className="px-4 pb-4">
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-xl hover:bg-primary/90 active:scale-98 transition-all disabled:opacity-50"
          >
            {installing ? (
              <>
                <Smartphone className="w-4 h-4 animate-pulse" />
                Installing…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Add to Home Screen
              </>
            )}
          </button>
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            Free · No app store needed · Works offline
          </p>
        </div>
      </div>
    </div>
  );
}
