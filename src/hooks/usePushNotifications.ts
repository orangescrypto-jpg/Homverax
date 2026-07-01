"use client";
/**
 * hooks/usePushNotifications.ts
 *
 * Web Push Notifications — now uses the Web Push API directly (no FCM).
 * VAPID keys managed via environment variables.
 *
 * For production push delivery, use a server-side Web Push library (e.g. web-push npm)
 * with your VAPID keys, triggered from API routes.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermissionState(Notification.permission);

    // Auto-register if already granted
    if (Notification.permission === "granted" && user?.id) {
      registerSubscription(user.id).catch(() => {});
    }
  }, [user?.id]);

  async function registerSubscription(userId: string): Promise<void> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Send subscription to server for storage
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, subscription }),
      });
    } catch {
      // Push subscription optional — fail silently
    }
  }

  async function requestPermission(): Promise<void> {
    if (!("Notification" in window)) {
      toast.error("Push notifications are not supported in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();
    setPermissionState(permission);

    if (permission === "granted" && user?.id) {
      await registerSubscription(user.id);
      toast.success("Push notifications enabled!");
    } else if (permission === "denied") {
      toast.error("Notification permission denied. Enable it in browser settings.");
    }
  }

  return {
    permissionState,
    permission: permissionState,           // alias
    isSupported: typeof window !== "undefined" && "Notification" in window,
    requestPermission,
  };
}
