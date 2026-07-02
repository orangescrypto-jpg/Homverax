"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Shield, ChevronLeft, CheckCircle2, Clock,
  AlertTriangle, AlertCircle, Loader2,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getEscrowById, holdEscrow, startInspection,
  confirmDelivery, openDispute,
} from "@/services/escrow";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { ESCROW_STEPS, PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { toast } from "sonner";
import type { EscrowTransaction } from "@/types";

export default function EscrowBookingPage() {
  const router = useRouter();
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [escrow, setEscrow] = useState<EscrowTransaction | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    getEscrowById(bookingId)
      .then(setEscrow)
      .catch(() => toast.error("Failed to load escrow transaction"))
      .finally(() => setPageLoading(false));
  }, [bookingId, isAuthenticated]);

  const act = async (fn: () => Promise<void>, successMsg: string) => {
    setIsActing(true);
    try {
      await fn();
      const updated = await getEscrowById(bookingId);
      setEscrow(updated);
      toast.success(successMsg);
    } catch {
      toast.error("Action failed. Please try again.");
    } finally {
      setIsActing(false);
    }
  };

  const handleDisputeSubmit = async () => {
    if (!disputeReason.trim()) { toast.error("Please describe the issue"); return; }
    await act(
      () => openDispute(bookingId, disputeReason),
      "Dispute opened. Our team will review within 24 hours."
    );
    setShowDispute(false);
  };

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h1 className="text-2xl font-serif font-bold mb-4">Sign in to view this transaction</h1>
          <Button onClick={() => router.push("/login")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <Shield className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-serif font-bold">Transaction not found</h2>
          <p className="text-muted-foreground text-sm mt-2 mb-6">
            This escrow transaction may not exist or you don&apos;t have access.
          </p>
          <Button onClick={() => router.push("/dashboard/escrow")}>Go to Escrow</Button>
        </div>
      </div>
    );
  }

  const currentStepIdx = ESCROW_STEPS.findIndex((s) => s.key === escrow.status);
  const isBuyer = escrow.buyerId === user?.id;
  const isSeller = escrow.sellerId === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-card border border-border rounded-2xl p-6 mb-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-serif font-bold text-foreground">{escrow.listingTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{escrow.listingLocation}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-serif font-bold text-primary">{formatCurrency(escrow.amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                + {formatCurrency(escrow.buyerServiceCharge)} ({escrow.buyerServiceChargePercent}% fee)
              </p>
            </div>
          </div>

          {/* Progress steps */}
          {!["disputed", "resolved", "refunded"].includes(escrow.status) && (
            <div className="mb-6">
              <div className="flex items-center gap-0">
                {ESCROW_STEPS.map((s, i) => {
                  const done = i < currentStepIdx;
                  const active = i === currentStepIdx;
                  return (
                    <div key={s.key} className="flex-1 flex flex-col items-center">
                      <div className="flex items-center w-full">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                            done ? "bg-primary border-primary" :
                            active ? "bg-primary/10 border-primary" :
                            "bg-secondary border-border"
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                          ) : (
                            <span className={`text-xs font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>
                              {i + 1}
                            </span>
                          )}
                        </div>
                        {i < ESCROW_STEPS.length - 1 && (
                          <div className={`flex-1 h-0.5 ${done ? "bg-primary" : "bg-border"}`} />
                        )}
                      </div>
                      <p className={`text-[10px] mt-1.5 text-center font-medium leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}>
                        {s.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dispute banner */}
          {escrow.status === "disputed" && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-400">Dispute Open</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-300">{escrow.disputeReason}</p>
              <p className="text-xs text-red-500 mt-2">Our team will review within 24 hours.</p>
            </div>
          )}

          {/* Resolved / refunded banner */}
          {["resolved", "refunded", "released"].includes(escrow.status) && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400 capitalize">
                Transaction {escrow.status}
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-foreground">Transaction Timeline</h3>
            {[
              { label: "Escrow initiated", date: escrow.createdAt },
              { label: "Payment received", date: escrow.depositPaidAt },
              { label: "Funds held", date: escrow.fundsHeldAt },
              { label: "Inspection started", date: escrow.inspectionDate },
              { label: "Funds released", date: escrow.releasedAt },
              { label: "Dispute opened", date: escrow.disputeOpenedAt },
              { label: "Resolved", date: escrow.resolvedAt },
            ]
              .filter((t) => t.date)
              .map((t) => (
                <div key={t.label} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-foreground">{t.label}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{timeAgo(t.date!)}</span>
                </div>
              ))}
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {isSeller && escrow.status === "funded" && (
              <Button
                className="w-full gap-2"
                onClick={() => act(() => holdEscrow(bookingId), "Funds are now held securely.")}
                disabled={isActing}
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Confirm Receipt of Payment
              </Button>
            )}

            {isSeller && escrow.status === "held" && (
              <Button
                className="w-full gap-2"
                onClick={() => act(() => startInspection(bookingId, new Date().toISOString()), "Inspection period started.")}
                disabled={isActing}
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                Start Inspection Period
              </Button>
            )}

            {isBuyer && escrow.status === "inspection" && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => act(() => confirmDelivery(bookingId), "Delivery confirmed! Funds released to seller.")}
                disabled={isActing}
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm & Release Funds
              </Button>
            )}

            {isBuyer && ["held", "inspection"].includes(escrow.status) && !showDispute && (
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => setShowDispute(true)}
              >
                <AlertTriangle className="w-4 h-4" />
                Open Dispute
              </Button>
            )}

            {showDispute && (
              <div className="space-y-3 p-4 bg-secondary/50 rounded-xl">
                <p className="text-sm font-medium text-foreground">Describe the issue</p>
                <Textarea
                  placeholder="Explain why you're opening a dispute…"
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={handleDisputeSubmit}
                    disabled={isActing || !disputeReason.trim()}
                  >
                    {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Dispute"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowDispute(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Safety note */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-primary inline mr-1.5 relative -top-0.5" />
          Your funds are securely held by HomveraX and will only be released when you confirm
          everything is satisfactory. Contact support if you have any issues.
        </div>
      </div>
    </div>
  );
}
