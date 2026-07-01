"use client";

import { useState } from "react";
import {
  CheckCircle2, Clock, Shield, Search,
  Building2, AlertCircle, ArrowRight,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEscrowById } from "@/services/escrow";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import type { EscrowTransaction } from "@/types";

const STATUS_STEPS = [
  { key: "pending",    label: "Initiated",       icon: Clock,        desc: "Escrow created, awaiting payment" },
  { key: "funded",     label: "Payment Received", icon: CheckCircle2, desc: "Funds confirmed by admin" },
  { key: "held",       label: "Funds Held",       icon: Shield,       desc: "Payment secured in escrow" },
  { key: "inspection", label: "Inspection",       icon: Search,       desc: "Property inspection window open" },
  { key: "released",   label: "Completed",        icon: CheckCircle2, desc: "Funds released to seller" },
];

const STATUS_ORDER = ["pending", "awaiting_confirmation", "funded", "held", "inspection", "released"];

function getStepIndex(status: string): number {
  return STATUS_ORDER.indexOf(status);
}

export default function TrackEscrowPage() {
  const [query, setQuery]         = useState("");
  const [escrow, setEscrow]       = useState<EscrowTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState("");
  const [searched, setSearched]   = useState(false);

  const handleSearch = async () => {
    const id = query.trim();
    if (!id) { setError("Enter an escrow ID"); return; }
    setIsLoading(true);
    setError("");
    setEscrow(null);
    setSearched(true);

    try {
      const result = await getEscrowById(id);
      if (!result) {
        setError("No escrow found with that ID. Check the ID and try again.");
      } else {
        setEscrow(result);
      }
    } catch {
      setError("Failed to look up escrow. Try again shortly.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentStep = escrow ? getStepIndex(escrow.status) : -1;
  const isDisputed  = escrow?.status === "disputed";
  const isRefunded  = escrow?.status === "refunded";

  // Mask participant names for privacy (show first name + ***)
  const maskName = (name?: string) =>
    name ? `${name.split(" ")[0]} ${"*".repeat(Math.max(3, (name.split(" ")[1]?.length ?? 3)))}` : "Anonymous";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <div className="bg-card border-b border-border py-14 px-4 text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Track Escrow</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Enter your escrow deal ID to see the current status — no account required.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Search box */}
        <div className="flex gap-3 mb-8">
          <Input
            className="flex-1 h-12 text-base"
            placeholder="Enter Escrow ID (e.g. abc123xyz)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button
            className="h-12 px-6 gap-2 shrink-0"
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Track
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Escrow result */}
        {escrow && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-semibold text-foreground">{escrow.listingTitle}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ID: <span className="font-mono">{escrow.id}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-serif font-bold text-foreground">
                    {formatCurrency(escrow.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo(escrow.createdAt)}</p>
                </div>
              </div>

              {/* Parties — masked for privacy */}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>Buyer: <strong className="text-foreground">{maskName(escrow.buyerId ? "Buyer" : undefined)}</strong></span>
                <ArrowRight className="w-3 h-3" />
                <span>Seller: <strong className="text-foreground">{maskName(escrow.sellerId ? "Seller" : undefined)}</strong></span>
              </div>
            </div>

            {/* Disputed / Refunded special states */}
            {(isDisputed || isRefunded) && (
              <div className={cn(
                "px-5 py-4 flex items-start gap-3",
                isDisputed ? "bg-red-50 border-b border-red-100" : "bg-green-50 border-b border-green-100"
              )}>
                <AlertCircle className={cn("w-5 h-5 shrink-0 mt-0.5", isDisputed ? "text-red-500" : "text-green-500")} />
                <div>
                  <p className={cn("text-sm font-semibold", isDisputed ? "text-red-700" : "text-green-700")}>
                    {isDisputed ? "Dispute In Progress" : "Refunded"}
                  </p>
                  <p className={cn("text-xs mt-0.5", isDisputed ? "text-red-600" : "text-green-600")}>
                    {isDisputed
                      ? "This deal has an open dispute. Our team is reviewing it."
                      : "This escrow has been refunded to the buyer."}
                  </p>
                </div>
              </div>
            )}

            {/* Progress timeline */}
            {!isDisputed && !isRefunded && (
              <div className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-5">
                  Deal Progress
                </p>
                <div className="space-y-0">
                  {STATUS_STEPS.map((step, idx) => {
                    const stepIdx  = STATUS_ORDER.indexOf(step.key);
                    const done     = currentStep >= stepIdx;
                    const active   = currentStep === stepIdx;
                    const isLast   = idx === STATUS_STEPS.length - 1;
                    const Icon     = step.icon;
                    return (
                      <div key={step.key} className="flex gap-4">
                        {/* Icon + line */}
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all shrink-0",
                            done
                              ? "bg-primary border-primary"
                              : active
                              ? "bg-primary/10 border-primary"
                              : "bg-secondary border-border"
                          )}>
                            <Icon className={cn("w-4 h-4", done ? "text-primary-foreground" : active ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          {!isLast && (
                            <div className={cn("w-0.5 h-8 mt-1", done ? "bg-primary" : "bg-border")} />
                          )}
                        </div>
                        {/* Text */}
                        <div className="pb-8 pt-1.5">
                          <p className={cn("text-sm font-semibold", done ? "text-foreground" : "text-muted-foreground")}>
                            {step.label}
                            {active && (
                              <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-normal">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Platform fee note */}
            {escrow.platformFee > 0 && (
              <div className="px-5 pb-5">
                <div className="bg-secondary/50 rounded-xl p-3 text-xs text-muted-foreground">
                  Platform fee: {formatCurrency(escrow.platformFee)} ·
                  Seller receives: {formatCurrency(escrow.amount - escrow.platformFee)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* How to find escrow ID */}
        {!searched && (
          <div className="bg-secondary/30 border border-border rounded-2xl p-5 mt-4">
            <p className="text-sm font-semibold text-foreground mb-2">Where to find your Escrow ID</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                Log in to HomveraX and go to Dashboard → Escrow
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                Click on your deal — the ID is in the URL bar
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                Or check your email confirmation — the ID is included
              </li>
            </ul>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
