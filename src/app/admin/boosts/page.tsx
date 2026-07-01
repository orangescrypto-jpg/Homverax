"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, Clock, Flame, Loader2,
  RefreshCw, Rocket, Star, X, XCircle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getAllBoostPayments,
  approveBoostPayment,
  rejectBoostPayment,
} from "@/services/subscriptions";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BoostPaymentRecord } from "@/services/subscriptions";

const BOOST_ICONS: Record<string, React.ElementType> = {
  featured:      Star,
  top_placement: Rocket,
  urgent:        Flame,
};

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminBoostsPage() {
  const { user } = useAuth();
  const [payments, setPayments]     = useState<BoostPaymentRecord[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [filter, setFilter]         = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setIsLoading(true);
    try {
      const list = await getAllBoostPayments();
      setPayments(list);
    } catch { toast.error("Failed to load boost payments"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (payment: BoostPaymentRecord) => {
    if (!user) return;
    setProcessing(payment.id);
    try {
      await approveBoostPayment(payment.id, user.name);
      setPayments((prev) => prev.map((p) =>
        p.id === payment.id ? { ...p, status: "approved" } : p
      ));
      toast.success(`Boost approved! "${payment.listingTitle}" is now ${payment.boostLabel}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to approve boost");
    } finally { setProcessing(null); }
  };

  const handleReject = async (payment: BoostPaymentRecord) => {
    if (!user) return;
    setProcessing(payment.id);
    try {
      await rejectBoostPayment(payment.id, user.name, rejectNotes[payment.id] ?? "");
      setPayments((prev) => prev.map((p) =>
        p.id === payment.id ? { ...p, status: "rejected" } : p
      ));
      toast.success("Boost payment rejected");
    } catch { toast.error("Failed to reject"); }
    finally { setProcessing(null); }
  };

  const filtered = payments.filter((p) => filter === "all" || p.status === filter);
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" /> Boost Payments
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review and activate listing boost requests.
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

      {/* Filter tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit mb-6">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
              filter === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {f}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Rocket className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-foreground">No {filter !== "all" ? filter : ""} boost payments</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((payment) => {
            const BoostIcon = BOOST_ICONS[payment.boostType] ?? Star;
            return (
              <div key={payment.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Icon + info */}
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <BoostIcon className="w-5 h-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-foreground">{payment.listingTitle}</p>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full capitalize",
                        STATUS_STYLE[payment.status]
                      )}>
                        {payment.status === "pending" && <Clock className="w-3 h-3 inline mr-1" />}
                        {payment.status === "approved" && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                        {payment.status === "rejected" && <XCircle className="w-3 h-3 inline mr-1" />}
                        {payment.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-lg">
                        {payment.boostLabel}
                      </span>
                      <span className="font-bold text-foreground">{formatCurrency(payment.amount)}</span>
                      <span className="text-muted-foreground">{timeAgo(payment.createdAt)}</span>
                      <span className="text-muted-foreground text-xs">User: {payment.userId.slice(0, 8)}…</span>
                    </div>

                    {/* Proof image */}
                    {payment.proofUrl && (
                      <div className="mt-3">
                        <a href={payment.proofUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                          📎 View Payment Proof
                        </a>
                      </div>
                    )}

                    {payment.processedBy && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Processed by {payment.processedBy}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {payment.status === "pending" && (
                    <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                      <div className="flex gap-2">
                        <Button size="sm"
                          className="flex-1 sm:flex-none gap-1 bg-green-600 hover:bg-green-700 text-white"
                          disabled={processing === payment.id}
                          onClick={() => handleApprove(payment)}>
                          {processing === payment.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CheckCircle2 className="w-4 h-4" />}
                          Approve & Activate
                        </Button>
                        <Button size="sm" variant="outline"
                          className="flex-1 sm:flex-none gap-1 border-red-200 text-red-600 hover:bg-red-50"
                          disabled={processing === payment.id}
                          onClick={() => handleReject(payment)}>
                          <X className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Rejection reason (optional)…"
                        className="text-xs h-14 resize-none"
                        value={rejectNotes[payment.id] ?? ""}
                        onChange={(e) => setRejectNotes((prev) => ({ ...prev, [payment.id]: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
