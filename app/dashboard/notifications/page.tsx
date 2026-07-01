"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getNotifications, markNotificationRead, markAllRead } from "@/services/notifications";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { Notification, NotificationType } from "@/types";
import { cn } from "@/lib/utils";

const TYPE_COLOR: Record<NotificationType, string> = {
  lead: "bg-blue-100 text-blue-600",
  payment: "bg-green-100 text-green-600",
  verification: "bg-yellow-100 text-yellow-600",
  escrow: "bg-indigo-100 text-indigo-600",
  booking: "bg-purple-100 text-purple-600",
  system: "bg-gray-100 text-gray-600",
  referral: "bg-orange-100 text-orange-600",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getNotifications(user.id)
      .then((data) => { void data; setNotifications(data as unknown as Notification[]); })
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All marked as read");
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Notifications</h1>
          {unread > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2 text-xs">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Bell className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No notifications</h2>
          <p className="text-muted-foreground text-sm">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && handleMarkRead(n.id)}
              className={cn(
                "flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                n.read
                  ? "bg-card border-border opacity-60"
                  : "bg-card border-primary/20 bg-primary/3 hover:bg-primary/5"
              )}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLOR[n.type] ?? "bg-secondary text-muted-foreground"}`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-sm font-medium", !n.read && "text-foreground", n.read && "text-foreground/70")}>
                    {n.title}
                  </p>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
