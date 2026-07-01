"use client";

import { useEffect, useState } from "react";
import {
  AlertOctagon, CheckCircle2, Loader2, MessageSquare,
  RefreshCw, Shield, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAllEscrows, resolveDispute } from "@/services/escrow";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { EscrowTransaction } from "@/types";

export default function AdminDisputesPage() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<EscrowTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const all = await getAllEscrows();
        setDisputes(all.filter((e) => e.status === "disputed"));
      } catch {
        toast.error("Failed to load disputes");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleResolve = async (id: string, refund: boolean) => {
    setActing(id);
    try {
      await resolveDispute(id, refund);
      setDisputes((prev) => prev.filter((d) => d.id !== id));
      toast.success(refund ? "Refund issued to buyer" : "Funds released to seller");
    } catch {
      toast.error("Failed to resolve dispute");
    } finally {
      setActing(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Disputes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {disputes.length} open dispute{disputes.length !== 1 ? "s" : ""} requiring resolution
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <AlertOctagon className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No open disputes</h2>
          <p className="text-muted-foreground text-sm">All disputes have been resolved.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.id} className="bg-card border-2 border-red-200 dark:border-red-800/30 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertOctagon className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">Open Dispute</span>
                    </div>
                    <h3 className="font-semibold text-foreground">{d.listingTitle}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{d.listingLocation}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground">{formatCurrency(d.amount)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(d.disputeOpenedAt ?? d.createdAt)}</p>
                  </div>
                </div>

                {/* Dispute reason */}
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl p-3 mb-4">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Buyer's Reason:</p>
                  <p className="text-sm text-red-600 dark:text-red-300">{d.disputeReason || "No reason provided"}</p>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-secondary/50 rounded-xl p-3 text-xs">
                    <p className="text-muted-foreground mb-1 font-medium">Buyer</p>
                    <p className="font-semibold text-foreground truncate">{d.buyerId}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 text-xs">
                    <p className="text-muted-foreground mb-1 font-medium">Seller</p>
                    <p className="font-semibold text-foreground truncate">{d.sellerId}</p>
                  </div>
                </div>

                {/* Moderator notes */}
                <div className="mb-4">
                  <Textarea
                    placeholder="Add moderator notes (optional, for internal records)…"
                    rows={2}
                    value={notes[d.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="text-sm"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    disabled={acting === d.id}
                    onClick={() => handleResolve(d.id, false)}
                  >
                    {acting === d.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Release to Seller
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    variant="outline"
                    disabled={acting === d.id}
                    onClick={() => handleResolve(d.id, true)}
                  >
                    {acting === d.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Refund Buyer
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
