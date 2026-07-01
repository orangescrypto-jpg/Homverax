"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, Clock, Crown,
  Search, RefreshCw, CreditCard,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
// ✅ FIX: Use service layer — updateUserSubscription for activating plans
import { updateUserSubscription, stampAgentRankBoost } from "@/services/auth";
// ✅ FIX: Use service layer — subscription payment reads/writes
import {
  getAllSubscriptionPayments,
  approveSubscriptionPayment,
  rejectSubscriptionPayment,
} from "@/services/subscriptions";

interface SubscriptionPayment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  plan: string;
  planName: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  note?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminSubscriptionsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const load = async () => {
    setIsLoading(true);
    try {
      // ✅ FIX: getAllSubscriptionPayments() from service layer
      const list = await getAllSubscriptionPayments();
      setPayments(list as SubscriptionPayment[]);
    } catch {
      toast.error("Failed to load payments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (payment: SubscriptionPayment) => {
    if (!user) return;
    setProcessing(payment.id);
    try {
      // ✅ FIX: approveSubscriptionPayment() + updateUserSubscription() from service layers
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1);

      await Promise.all([
        approveSubscriptionPayment(payment.id, user.name),
        updateUserSubscription(payment.userId, payment.plan, expiry.toISOString()),
        // ✅ Stamp rankBoost on all agent's active listings immediately
        stampAgentRankBoost(payment.userId, payment.plan),
      ]);

      setPayments((prev) =>
        prev.map((p) => p.id === payment.id ? { ...p, status: "approved" } : p)
      );
      toast.success(`${payment.userName}'s ${payment.planName} plan activated!`);
    } catch {
      toast.error("Failed to approve payment");
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (payment: SubscriptionPayment) => {
    if (!user) return;
    setProcessing(payment.id);
    try {
      // ✅ FIX: rejectSubscriptionPayment() from service layer
      await rejectSubscriptionPayment(payment.id, user.name, rejectNote[payment.id] ?? "");
      setPayments((prev) =>
        prev.map((p) => p.id === payment.id ? { ...p, status: "rejected" } : p)
      );
      toast.success("Payment rejected");
    } catch {
      toast.error("Failed to reject payment");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = payments.filter((p) => {
    const matchFilter = filter === "all" || p.status === filter;
    const matchSearch = !search ||
      p.userName.toLowerCase().includes(search.toLowerCase()) ||
      p.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      p.planName.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Subscription Payments
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review and activate user subscription payments
            {pendingCount > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors",
                filter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Crown className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No {filter !== "all" ? filter : ""} payments found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((payment) => (
            <div key={payment.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{payment.userName}</p>
                    <span className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-full capitalize",
                      STATUS_STYLE[payment.status]
                    )}>
                      {payment.status === "pending" && <Clock className="w-3 h-3 inline mr-1" />}
                      {payment.status === "approved" && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                      {payment.status === "rejected" && <XCircle className="w-3 h-3 inline mr-1" />}
                      {payment.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{payment.userEmail}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-lg">
                      {payment.planName} Plan
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {formatCurrency(payment.amount)}/month
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(payment.createdAt)}
                    </span>
                  </div>
                  {payment.note && (
                    <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 rounded-lg px-3 py-1.5">
                      Note: {payment.note}
                    </p>
                  )}
                  {payment.processedBy && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Processed by {payment.processedBy}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {payment.status === "pending" && (
                  <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 sm:flex-none gap-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => approve(payment)}
                        disabled={processing === payment.id}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {processing === payment.id ? "Processing…" : "Approve & Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-none gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => reject(payment)}
                        disabled={processing === payment.id}
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Rejection note (optional)…"
                      className="text-xs h-16 resize-none"
                      value={rejectNote[payment.id] ?? ""}
                      onChange={(e) =>
                        setRejectNote((prev) => ({ ...prev, [payment.id]: e.target.value }))
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
