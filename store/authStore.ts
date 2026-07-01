"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HomveraxUser, UserRole } from "@/types";

interface AuthStore {
  user: HomveraxUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: HomveraxUser | null) => void;
  setLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<HomveraxUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
    }),
    {
      name: "homverax-auth",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
