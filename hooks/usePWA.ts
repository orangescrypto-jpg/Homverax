"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for PWA support.
 * Call this hook once at the root layout or in a client component.
 */
export function usePWA() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[HomveraX PWA] Service worker registered:", registration.scope);
      })
      .catch((err) => {
        console.warn("[HomveraX PWA] Service worker registration failed:", err);
      });
  }, []);
}

/**
 * Requests permission for push notifications.
 * Returns the permission state.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}
