"use client";

/**
 * hooks/usePWAInstall.ts
 *
 * FIXES:
 * 1. Dismissed state now persisted in sessionStorage — survives page navigation
 *    but resets when user closes tab and comes back (so they see it next visit)
 * 2. Reads enablePWA feature flag from platformSettings — admin can turn off
 * 3. "accepted" outcome clears the dismissed flag permanently (no reason to show again)
 * 4. Banner reappears on new session if user previously dismissed (not installed)
 */

import { useEffect, useState } from "react";
import { getPlatformConfig } from "@/services/platformSettings";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SESSION_DISMISSED_KEY = "homverax_pwa_dismissed";
const PERM_INSTALLED_KEY    = "homverax_pwa_installed";

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt]   = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled]       = useState(false);
  const [isInstallable, setIsInstallable]   = useState(false);
  const [pwaEnabled, setPwaEnabled]         = useState(true);
  // ✅ FIX: dismissed lives in sessionStorage so it resets between visits
  // but survives page navigation within the same session
  const [dismissed, setDismissedState]      = useState(false);

  const setDismissed = (value: boolean) => {
    setDismissedState(value);
    if (value) {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
    } else {
      sessionStorage.removeItem(SESSION_DISMISSED_KEY);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ✅ Check if already permanently installed
    const alreadyInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      localStorage.getItem(PERM_INSTALLED_KEY) === "1";

    if (alreadyInstalled) {
      setIsInstalled(true);
      return;
    }

    // ✅ Check if dismissed this session
    if (sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1") {
      setDismissedState(true);
    }

    // ✅ Check enablePWA flag from admin settings
    getPlatformConfig()
      .then((cfg) => setPwaEnabled(cfg.features.enablePWA !== false))
      .catch(() => setPwaEnabled(true)); // fail open

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
      // ✅ Mark permanently installed so we never show the banner again
      localStorage.setItem(PERM_INSTALLED_KEY, "1");
      sessionStorage.removeItem(SESSION_DISMISSED_KEY);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!installPrompt) return "unavailable";
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
      localStorage.setItem(PERM_INSTALLED_KEY, "1");
      sessionStorage.removeItem(SESSION_DISMISSED_KEY);
    } else {
      // ✅ Dismissed — hide for this session, reappear next visit
      setDismissed(true);
      setInstallPrompt(null);
    }

    return outcome;
  };

  const dismiss = () => setDismissed(true);

  return {
    isInstallable: isInstallable && pwaEnabled && !dismissed && !isInstalled,
    isInstalled,
    pwaEnabled,
    dismissed,
    install,
    dismiss,
  };
}
