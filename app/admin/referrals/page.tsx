"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, CheckCircle2, Clock, Loader2, X, Wallet, CreditCard,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAllWithdrawals, processWithdrawal } from "@/services/referral";
import { formatCurrency, timeAgo } from "@/lib/utils";
import type { WithdrawalRequest } from "@/services/referral";
import { toast } from "sonner";

const STATUS_COLOR = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminReferralWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selected, setSelected] = useState<WithdrawalRequest | null>(null);
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"approved" | "rejected" | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAllWithdrawals(filter === "all" ? undefined : filter);
      setRequests(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const handleProcess = async () => {
    if (!selected || !action) return;
    setProcessing(selected.id);
    try {
      await processWithdrawal(selected.id, selected.userId, action, note);
      toast.success(`Withdrawal ${action}`);
      setSelected(null);
      setNote("");
      setAction(null);
      await load();
    } catch {
      toast.error("Failed to process withdrawal");
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Referral Withdrawals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Users' referral earning withdrawal requests with bank details.
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{pendingCount} pending</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No {filter === "all" ? "" : filter} withdrawal requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-foreground">{req.userName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[req.status]}`}>
                      {req.status}
                    </span>
                  </div>

                  {/* Bank details — prominently shown for admin */}
                  <div className="p-3 bg-secondary/50 rounded-xl mb-3 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Bank</p>
                      <p className="text-sm font-medium text-foreground">{req.bankName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Account Number</p>
                      <p className="text-sm font-medium text-foreground font-mono">{req.accountNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Account Name</p>
                      <p className="text-sm font-medium text-foreground">{req.accountName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Requested: {timeAgo(req.createdAt)}</span>
                    {req.processedAt && <span>Processed: {timeAgo(req.processedAt)}</span>}
                    {req.note && <span>Note: {req.note}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xl font-serif font-bold text-foreground">{formatCurrency(req.amount)}</p>
                  {req.status === "pending" && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline"
                        onClick={() => { setSelected(req); setAction("rejected"); }}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
                        <X className="w-3 h-3" /> Reject
                      </Button>
                      <Button size="sm"
                        onClick={() => { setSelected(req); setAction("approved"); }}
                        className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Process modal */}
      {selected && action && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground text-lg">
                {action === "approved" ? "Approve" : "Reject"} Withdrawal
              </h2>
              <button onClick={() => { setSelected(null); setAction(null); }} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-secondary/50 rounded-xl mb-4">
              <p className="text-sm font-semibold text-foreground mb-2">{selected.userName}</p>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{selected.bankName} — {selected.accountNumber}</span>
              </div>
              <p className="text-sm text-muted-foreground">{selected.accountName}</p>
              <p className="text-lg font-bold text-foreground mt-2">{formatCurrency(selected.amount)}</p>
            </div>

            {action === "approved" && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 rounded-xl mb-4">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Transfer <strong>{formatCurrency(selected.amount)}</strong> to the bank details above,
                  then click Confirm Approved.
                </p>
              </div>
            )}

            <div className="mb-4">
              <Label>Admin Note (optional)</Label>
              <Input className="mt-1" placeholder="e.g. Payment sent via GTBank" value={note}
                onChange={(e) => setNote(e.target.value)} />
            </div>

            <Button
              onClick={handleProcess}
              disabled={!!processing}
              className={`w-full gap-2 ${action === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}`}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {action === "approved" ? "Confirm Approved" : "Confirm Rejected"}
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
