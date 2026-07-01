"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, Building2, CheckCircle2, Copy, Crown,
  Loader2, Shield, Star, Users, Zap,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { getPlatformConfig } from "@/services/platformSettings";
// ✅ FIX: Use service layer — no inline Firestore
import { submitSubscriptionPayment, getUserPlanStatus } from "@/services/subscriptions";
import type { BankDetails } from "@/services/platformSettings";
import type { SubscriptionPlan } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Shield, basic: Star, pro: Zap, premium: Crown,
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [plans, setPlans]               = useState<SubscriptionPlan[]>([]);
  const [bank, setBank]                 = useState<BankDetails | null>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [proofFile, setProofFile]       = useState<File | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [activeListingCount, setActiveListingCount] = useState(0);

  const currentPlanSlug = user?.subscriptionPlan ?? "free";

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPlatformConfig(),
      getUserPlanStatus(user.id, currentPlanSlug, user.subscriptionExpiry),
    ])
      .then(([cfg, planStatus]) => {
        setPlans(cfg.subscriptionPlans);
        setBank(cfg.bank);
        setActiveListingCount(planStatus.activeListingCount);
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  const currentPlan = plans.find(p => p.slug === currentPlanSlug);
  const maxListings = currentPlan?.maxListings === 999999 ? "∞" : (currentPlan?.maxListings ?? 3);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // ✅ FIX: uses service layer — no inline Firestore
  const handleSubmitProof = async () => {
    if (!user || !selectedPlan) return;
    if (!proofFile) { toast.error("Please attach your payment proof"); return; }
    setSubmitting(true);
    try {
      await submitSubscriptionPayment({
        userId:    user.id,
        userName:  user.name,
        userEmail: user.email,
        plan:      selectedPlan.slug,
        planName:  selectedPlan.name,
        amount:    selectedPlan.price,
        proofFile,
      });
      setSubmitted(true);
      toast.success("Payment submitted! Admin will verify and activate your plan within 24 hours.");
    } catch {
      toast.error("Submission failed. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-72 rounded-2xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground">Subscription Plans</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upgrade to get more listings, verified badge, and priority placement.
        </p>
      </div>

      {/* Current plan status */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Current plan: <span className="capitalize">{currentPlanSlug}</span>
              </p>
              {user?.subscriptionExpiry && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Expires {new Date(user.subscriptionExpiry).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                </p>
              )}
            </div>
          </div>
          {/* ✅ Live listing usage */}
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">
              {activeListingCount} / {maxListings} listings used
            </p>
            <p className="text-xs text-muted-foreground">active listings</p>
          </div>
        </div>

        {/* Usage bar */}
        {maxListings !== "∞" && (
          <div className="mt-3">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  activeListingCount >= Number(maxListings) ? "bg-red-500" :
                  activeListingCount >= Number(maxListings) * 0.8 ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, (activeListingCount / Number(maxListings)) * 100)}%` }}
              />
            </div>
            {activeListingCount >= Number(maxListings) && (
              <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Listing limit reached — upgrade to post more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Plan feature comparison */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6 overflow-x-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">What each plan includes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Feature</th>
              {plans.map(p => (
                <th key={p.slug} className={cn(
                  "text-center py-2 px-3 font-semibold capitalize",
                  p.slug === currentPlanSlug ? "text-primary" : "text-foreground"
                )}>
                  {p.name}
                  {p.slug === currentPlanSlug && <span className="text-[10px] block text-primary">Current</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {[
              {
                label: "Max Listings",
                getValue: (p: SubscriptionPlan) => p.maxListings === 999999 ? "Unlimited" : String(p.maxListings),
              },
              {
                label: "Verified Badge",
                getValue: (p: SubscriptionPlan) => p.verifiedBadge ? "✅" : "❌",
              },
              {
                label: "Leads Access",
                getValue: (p: SubscriptionPlan) => p.leadsAccess ? "✅" : "❌",
              },
              {
                label: "Search Ranking Boost",
                getValue: (p: SubscriptionPlan) => p.rankBoost ? `${p.rankBoost}×` : "—",
              },
              {
                label: "Monthly Price",
                getValue: (p: SubscriptionPlan) => p.price === 0 ? "Free" : formatCurrency(p.price),
              },
            ].map(({ label, getValue }) => (
              <tr key={label}>
                <td className="py-2.5 pr-4 text-muted-foreground">{label}</td>
                {plans.map(p => (
                  <td key={p.slug} className={cn(
                    "text-center py-2.5 px-3",
                    p.slug === currentPlanSlug ? "font-semibold text-primary" : "text-foreground"
                  )}>
                    {getValue(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Manual Bank Transfer</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Select a plan, make a bank transfer, attach your proof, and submit.
            Admin activates your plan within 24 hours.
          </p>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {plans.map((plan) => {
          const isCurrent  = plan.slug === currentPlanSlug;
          const isSelected = selectedPlan?.slug === plan.slug;
          const PlanIcon   = PLAN_ICONS[plan.slug] ?? Star;
          const isDowngrade = plans.findIndex(p => p.slug === plan.slug) <
                              plans.findIndex(p => p.slug === currentPlanSlug);

          return (
            <div
              key={plan.slug}
              className={cn(
                "relative bg-card border-2 rounded-2xl p-6 flex flex-col transition-all",
                isSelected  ? "border-primary shadow-lg shadow-primary/20 cursor-pointer"
                : plan.highlighted ? "border-primary/40 cursor-pointer"
                : isCurrent ? "border-border opacity-80"
                : "border-border hover:border-primary/30 cursor-pointer",
              )}
              onClick={() => { if (!isCurrent && plan.price > 0) setSelectedPlan(plan); }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    Most Popular
                  </span>
                </div>
              )}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  isSelected || isCurrent ? "bg-primary/10" : "bg-secondary"
                )}>
                  <PlanIcon className={cn("w-4 h-4", isSelected || isCurrent ? "text-primary" : "text-muted-foreground")} />
                </div>
                <h3 className="font-serif font-bold text-foreground">{plan.name}</h3>
              </div>

              <div className="mb-4">
                {plan.price === 0 ? (
                  <span className="text-3xl font-serif font-bold text-foreground">Free</span>
                ) : (
                  <div>
                    <span className="text-3xl font-serif font-bold text-foreground">{formatCurrency(plan.price)}</span>
                    <span className="text-muted-foreground text-sm">/{plan.interval}</span>
                  </div>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={cn("w-full", isSelected ? "bg-primary text-primary-foreground" : "")}
                variant={isCurrent ? "secondary" : isSelected ? "default" : "outline"}
                disabled={isCurrent || plan.price === 0 || isDowngrade}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isCurrent && plan.price > 0 && !isDowngrade) setSelectedPlan(plan);
                }}
              >
                {isCurrent   ? "Current Plan"
                : plan.price === 0 ? "Free"
                : isDowngrade ? "Lower Plan"
                : isSelected  ? "✓ Selected"
                : `Upgrade · ${formatCurrency(plan.price)}`}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Payment instructions */}
      {selectedPlan && bank && !submitted && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Pay for {selectedPlan.name} — {formatCurrency(selectedPlan.price)}/month
          </h2>

          <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Transfer Details</p>
            {[
              { label: "Bank Name",       value: bank.bankName },
              { label: "Account Number",  value: bank.accountNumber },
              { label: "Account Name",    value: bank.accountName },
              { label: "Amount",          value: formatCurrency(selectedPlan.price) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-semibold text-foreground text-sm">{value}</p>
                </div>
                <button
                  onClick={() => copyText(value, label)}
                  className="p-2 rounded-lg hover:bg-background transition-colors"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
            {bank.bankNote && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{bank.bankNote}</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Attach Payment Proof <span className="text-red-500">*</span>
            </p>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Screenshot or PDF of your bank transfer receipt. Required for verification.
            </p>
          </div>

          {/* What you'll unlock */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-xs font-semibold text-primary mb-2">After activation you'll get:</p>
            <ul className="space-y-1">
              {[
                `Up to ${selectedPlan.maxListings === 999999 ? "unlimited" : selectedPlan.maxListings} active listings`,
                ...(selectedPlan.verifiedBadge  ? ["✓ Verified agent badge"] : []),
                ...(selectedPlan.leadsAccess    ? ["✓ Access to tenant leads"] : []),
                ...(selectedPlan.rankBoost      ? [`✓ ${selectedPlan.rankBoost}× search ranking boost`] : []),
              ].map((item) => (
                <li key={item} className="text-xs text-primary/80 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1 gap-2"
              onClick={handleSubmitProof}
              disabled={submitting || !proofFile}
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                : "I've Made Payment — Submit"
              }
            </Button>
            <Button variant="outline" onClick={() => { setSelectedPlan(null); setProofFile(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="font-semibold text-green-800 text-lg">Payment Submitted!</h2>
          <p className="text-sm text-green-700 mt-1">
            Your payment for <strong>{selectedPlan?.name}</strong> has been submitted with proof.
            Admin will verify and activate your plan within 24 hours.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-8">
        All plans billed monthly in ₦ · Manual bank transfer · Contact support if you need help
      </p>
    </DashboardLayout>
  );
}
