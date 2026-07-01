"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, Gift, RefreshCw, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { getAllWithdrawals, processWithdrawal, type WithdrawalRequest } from "@/services/referral";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminReferralsPage() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAllWithdrawals();
      setWithdrawals(data);
    } catch {
      toast.error("Failed to load withdrawals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handle = async (w: WithdrawalRequest, action: "approved" | "rejected") => {
    setProcessing(w.id);
    try {
      await processWithdrawal(w.id, w.userId, action, notes[w.id]);
      setWithdrawals((prev) =>
        prev.map((x) => x.id === w.id ? { ...x, status: action } : x)
      );
      toast.success(action === "approved" ? `₦${w.amount.toLocaleString()} approved for ${w.userName}` : "Request rejected");
    } catch {
      toast.error("Action failed");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = withdrawals.filter((w) => {
    const matchFilter = filter === "all" || w.status === filter;
    const matchSearch = !search ||
      w.userName.toLowerCase().includes(search.toLowerCase()) ||
      w.accountName.toLowerCase().includes(search.toLowerCase()) ||
      w.bankName.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            Referral Withdrawals
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Approve or reject referral payout requests
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
            placeholder="Search by name or bank…"
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

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No {filter !== "all" ? filter : ""} withdrawal requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((w) => (
            <div key={w.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{w.userName}</p>
                    <span className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-full capitalize",
                      STATUS_STYLE[w.status]
                    )}>
                      {w.status === "pending" && <Clock className="w-3 h-3 inline mr-1" />}
                      {w.status === "approved" && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                      {w.status === "rejected" && <XCircle className="w-3 h-3 inline mr-1" />}
                      {w.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(w.createdAt)}</span>
                  </div>

                  {/* Bank details */}
                  <div className="mt-3 bg-secondary/50 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Amount</span>
                      <span className="font-bold text-foreground">{formatCurrency(w.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Bank</span>
                      <span className="text-sm text-foreground">{w.bankName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Account</span>
                      <span className="text-sm font-mono text-foreground">{w.accountNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Name</span>
                      <span className="text-sm text-foreground">{w.accountName}</span>
                    </div>
                  </div>

                  {w.note && (
                    <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 rounded-lg px-3 py-1.5">
                      Note: {w.note}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {w.status === "pending" && (
                  <div className="flex flex-col gap-2 w-full sm:w-64 shrink-0">
                    <Textarea
                      placeholder="Note (optional)…"
                      className="text-xs h-16 resize-none"
                      value={notes[w.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handle(w, "approved")}
                        disabled={processing === w.id}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {processing === w.id ? "…" : "Pay & Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handle(w, "rejected")}
                        disabled={processing === w.id}
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
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
