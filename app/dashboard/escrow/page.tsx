"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Shield, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyEscrows } from "@/services/escrow";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { EscrowTransaction } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  funded: { label: "Funded", color: "bg-blue-100 text-blue-700", icon: Shield },
  held: { label: "Held", color: "bg-indigo-100 text-indigo-700", icon: Shield },
  inspection: { label: "Inspection", color: "bg-purple-100 text-purple-700", icon: Clock },
  released: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  disputed: { label: "Disputed", color: "bg-red-100 text-red-700", icon: AlertCircle },
  resolved: { label: "Resolved", color: "bg-gray-100 text-gray-600", icon: CheckCircle2 },
  refunded: { label: "Refunded", color: "bg-orange-100 text-orange-700", icon: ArrowRight },
};

const STEPS = ["pending", "funded", "held", "inspection", "released"];

function EscrowProgress({ status }: { status: string }) {
  const idx = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-3">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i < idx ? "bg-primary" : i === idx ? "bg-primary ring-2 ring-primary/30" : "bg-border"
            }`}
          />
          {i < STEPS.length - 1 && (
            <div className={`h-px w-8 ${i < idx ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function EscrowDashboardPage() {
  const { user } = useAuth();
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    if (!user) return;
    getMyEscrows(user.id)
      .then(setEscrows)
      .catch(() => toast.error("Failed to load escrow transactions"))
      .finally(() => setIsLoading(false));
  }, [user]);

  const filtered = escrows.filter((e) => {
    if (filter === "active") return !["released", "refunded", "resolved"].includes(e.status);
    if (filter === "completed") return ["released", "refunded", "resolved"].includes(e.status);
    return true;
  });

  const totalHeld = escrows
    .filter((e) => ["funded", "held", "inspection"].includes(e.status))
    .reduce((acc, e) => acc + e.amount, 0);
  const completed = escrows.filter((e) => e.status === "released").length;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Escrow</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track all your secure payment transactions
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5">
          <Shield className="w-5 h-5 text-primary mb-3" />
          <p className="text-2xl font-serif font-bold">{formatCurrency(totalHeld)}</p>
          <p className="text-xs text-muted-foreground mt-1">Currently held</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <CheckCircle2 className="w-5 h-5 text-green-500 mb-3" />
          <p className="text-2xl font-serif font-bold">{completed}</p>
          <p className="text-xs text-muted-foreground mt-1">Completed deals</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <Clock className="w-5 h-5 text-yellow-500 mb-3" />
          <p className="text-2xl font-serif font-bold">{escrows.filter((e) => e.status === "pending").length}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-secondary/50 p-1 rounded-xl w-fit">
        {(["all", "active", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
              filter === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Shield className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No escrow transactions</h2>
          <p className="text-muted-foreground text-sm mb-6">
            When you make or receive a payment through HomveraX, it will appear here.
          </p>
          <Link href="/listings">
            <Button>Browse Listings</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const cfg = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <Link key={e.id} href={`/dashboard/escrow/${e.id}`}>
                <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{e.listingTitle}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {e.role === "buyer" ? "You are buying" : "You are selling"} · {e.listingLocation}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground">{formatCurrency(e.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {!["disputed", "resolved", "refunded"].includes(e.status) && (
                    <EscrowProgress status={e.status} />
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</span>
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      View details <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
