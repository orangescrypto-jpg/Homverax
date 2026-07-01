"use client";

import { useEffect } from "react";
import { onAuthChange } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

/**
 * AuthProvider — mounts once at the root and keeps Zustand in sync
 * with Firebase Auth state changes (login, logout, token refresh).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Set loading immediately before subscribing
    setLoading(true);
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}

/**
 * useAuth — convenience hook
 */
export function useAuth() {
  return useAuthStore();
}
