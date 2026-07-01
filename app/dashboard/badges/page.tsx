"use client";

import { useEffect, useState } from "react";
import { Award, Lock, Star } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { getUserBadges, BADGE_DEFS } from "@/services/badges";
import { timeAgo, cn } from "@/lib/utils";
import type { Badge, BadgeId } from "@/services/badges";

export default function BadgesPage() {
  const { user } = useAuth();
  const [earned, setEarned]     = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserBadges(user.id)
      .then(setEarned)
      .finally(() => setIsLoading(false));
  }, [user]);

  const earnedIds = new Set(earned.map((b) => b.id));
  const allBadges = Object.values(BADGE_DEFS);

  const role = user?.role ?? "tenant";
  const isSeller = ["agent", "landlord", "service_provider"].includes(role);

  // Show relevant badges based on role
  const relevant = allBadges.filter((b) => {
    if (["first_deal", "trusted_buyer", "power_buyer", "loyal_buyer"].includes(b.id)) return !isSeller;
    if (["first_sale", "active_seller", "top_seller", "elite_seller"].includes(b.id)) return isSeller;
    return true; // special badges shown to all
  });

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <Award className="w-6 h-6 text-primary" /> My Badges
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {earned.length} of {relevant.length} badges earned
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Achievement Progress</p>
          <p className="text-sm font-bold text-primary">{earned.length}/{relevant.length}</p>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${relevant.length ? (earned.length / relevant.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {relevant.map((def) => {
            const isEarned = earnedIds.has(def.id as BadgeId);
            const earnedBadge = earned.find((b) => b.id === def.id);

            return (
              <div
                key={def.id}
                className={cn(
                  "rounded-2xl border-2 p-5 text-center transition-all",
                  isEarned
                    ? "border-primary/30 bg-card shadow-sm"
                    : "border-border bg-card opacity-50"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl",
                  isEarned ? def.color : "bg-secondary text-muted-foreground"
                )}>
                  {isEarned ? def.icon : <Lock className="w-6 h-6" />}
                </div>

                <p className={cn(
                  "text-sm font-bold mb-1",
                  isEarned ? "text-foreground" : "text-muted-foreground"
                )}>
                  {def.label}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {def.description}
                </p>

                {isEarned && earnedBadge && (
                  <p className="text-[10px] text-primary font-semibold mt-2">
                    Earned {timeAgo(earnedBadge.earnedAt)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Motivation footer */}
      {earned.length < relevant.length && (
        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center">
          <Star className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Keep going!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Complete more {isSeller ? "escrow sales" : "escrow purchases"} to unlock your next badge.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
