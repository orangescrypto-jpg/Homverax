"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, BarChart2, CheckCircle2, ChevronDown,
  ExternalLink, Globe, Loader2, Rocket, Search,
  TrendingUp, X, XCircle, Zap,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  checkAdBoostEnabled,
  checkListingEligibility,
  getAdBoostPlans,
  createAdBoost,
  subscribeToMyAdBoosts,
  cancelAdBoost,
  FeatureDisabledError,
} from "@/services/adBoostService";
import { getMyListings } from "@/services/listings";
import { formatCurrency, cn, timeAgo } from "@/lib/utils";
import type { AdBoostPlan, AdBoost, EligibilityResult } from "@/services/adBoostService";
import type { PropertyListing } from "@/types";
import { toast } from "sonner";

// ─── Platform icons ────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  google:    { label: "Google",    color: "text-blue-600",   bg: "bg-blue-100"   },
  instagram: { label: "Instagram", color: "text-pink-600",   bg: "bg-pink-100"   },
  facebook:  { label: "Facebook",  color: "text-blue-700",   bg: "bg-blue-100"   },
  tiktok:    { label: "TikTok",    color: "text-slate-800",  bg: "bg-slate-100"  },
  twitter:   { label: "X",         color: "text-slate-700",  bg: "bg-slate-100"  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending Review",    color: "bg-yellow-100 text-yellow-700" },
  active:    { label: "Approved",          color: "bg-blue-100 text-blue-700"     },
  running:   { label: "Running",           color: "bg-green-100 text-green-700"   },
  completed: { label: "Completed",         color: "bg-secondary text-muted-foreground" },
  cancelled: { label: "Cancelled",         color: "bg-red-100 text-red-600"       },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdBoostPage() {
  const { user } = useAuth();

  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [plans, setPlans]         = useState<AdBoostPlan[]>([]);
  const [listings, setListings]   = useState<PropertyListing[]>([]);
  const [activeBoosts, setActiveBoosts] = useState<AdBoost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Step state
  const [selectedPlan, setSelectedPlan]           = useState<AdBoostPlan | null>(null);
  const [selectedListing, setSelectedListing]     = useState<PropertyListing | null>(null);
  const [eligibility, setEligibility]             = useState<EligibilityResult | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isSubmitting, setIsSubmitting]           = useState(false);
  const [listingSearch, setListingSearch]         = useState("");
  const [showListingDrop, setShowListingDrop]     = useState(false);
  const [paymentRef, setPaymentRef]               = useState("");
  const [showPaymentModal, setShowPaymentModal]   = useState(false);
  const [cancellingId, setCancellingId]           = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Check if feature is on
    checkAdBoostEnabled()
      .then(() => setIsEnabled(true))
      .catch((e) => {
        if (e instanceof FeatureDisabledError) setIsEnabled(false);
      });

    // Load plans + listings
    Promise.all([getAdBoostPlans(), getMyListings(user.id)])
      .then(([p, l]) => { setPlans(p); setListings(l); })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setIsLoading(false));

    // Real-time active boosts
    const unsub = subscribeToMyAdBoosts(user.id, setActiveBoosts);
    return () => unsub();
  }, [user]);

  // Check eligibility when listing selected
  useEffect(() => {
    if (!selectedListing) { setEligibility(null); return; }
    setIsCheckingEligibility(true);
    checkListingEligibility(selectedListing.id)
      .then(setEligibility)
      .finally(() => setIsCheckingEligibility(false));
  }, [selectedListing]);

  const filteredListings = listings.filter((l) =>
    l.title.toLowerCase().includes(listingSearch.toLowerCase())
  );

  const handlePurchase = async () => {
    if (!user || !selectedPlan || !selectedListing || !paymentRef.trim()) return;
    setIsSubmitting(true);
    try {
      await createAdBoost({
        agentId:         user.id,
        agentName:       user.name,
        listingId:       selectedListing.id,
        listingTitle:    selectedListing.title,
        listingImage:    selectedListing.images?.[0] ?? "",
        listingLocation: `${selectedListing.location.lga}, ${selectedListing.location.state}`,
        planType:        selectedPlan.planType,
        planName:        selectedPlan.name,
        platforms:       selectedPlan.platforms,
        amountPaid:      selectedPlan.price,
        adSpendBudget:   selectedPlan.adSpendAllocation,
        marginAmount:    selectedPlan.price - selectedPlan.adSpendAllocation,
        paymentRef:      paymentRef.trim(),
      });
      toast.success("Ad Boost submitted! Admin will activate your campaign within 24 hours.");
      setShowPaymentModal(false);
      setSelectedPlan(null);
      setSelectedListing(null);
      setEligibility(null);
      setPaymentRef("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create boost");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (boost: AdBoost) => {
    if (!user) return;
    setCancellingId(boost.id);
    try {
      await cancelAdBoost(boost.id, user.id);
      toast.success("Boost cancelled. Refund will be processed within 1–2 business days.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  };

  // ── Feature disabled ────────────────────────────────────────────────────────

  if (isEnabled === false) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
            <Rocket className="w-10 h-10 text-muted-foreground opacity-40" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Ad Boost Coming Soon</h1>
          <p className="text-muted-foreground text-sm">
            External advertising campaigns for your listings are not yet available.
            Check back soon or contact support for more information.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading || isEnabled === null) {
    return (
      <DashboardLayout>
        <div className="flex items-center gap-2 text-muted-foreground py-10">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading Ad Boost...</span>
        </div>
      </DashboardLayout>
    );
  }

  // ── Main UI ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-serif font-bold text-foreground">Ad Boost</h1>
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">New</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Promote your listings externally on Google, Instagram, Facebook, TikTok, and X.
          Get your property in front of thousands of active property seekers.
        </p>
      </div>

      <div className="space-y-6 max-w-4xl">

        {/* Active boosts */}
        {activeBoosts.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Active Campaigns ({activeBoosts.length})
            </h2>
            <div className="space-y-3">
              {activeBoosts.map((boost) => {
                const st = STATUS_CONFIG[boost.status];
                return (
                  <div key={boost.id} className="border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-start gap-4 p-4">
                      {boost.listingImage && (
                        <img src={boost.listingImage} alt="" className="w-16 h-16 object-cover rounded-xl shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground truncate">{boost.listingTitle}</p>
                            <p className="text-xs text-muted-foreground">{boost.listingLocation}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", st.color)}>
                              {st.label}
                            </span>
                            {boost.status === "pending" && (
                              <button
                                onClick={() => handleCancel(boost)}
                                disabled={cancellingId === boost.id}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                {cancellingId === boost.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <X className="w-4 h-4" />
                                }
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Platforms */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {boost.platforms.map((p) => {
                            const pc = PLATFORM_CONFIG[p];
                            return (
                              <span key={p} className={cn("text-xs px-2 py-0.5 rounded-full font-medium", pc.bg, pc.color)}>
                                {pc.label}
                              </span>
                            );
                          })}
                        </div>

                        {/* Stats if running */}
                        {boost.status === "running" && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            {[
                              { label: "Impressions", value: boost.impressions.toLocaleString() },
                              { label: "Clicks",      value: boost.clicks.toLocaleString()      },
                              { label: "Reach",       value: boost.reach.toLocaleString()       },
                            ].map(({ label, value }) => (
                              <div key={label} className="bg-secondary/50 rounded-xl p-2 text-center">
                                <p className="text-sm font-bold text-foreground">{value}</p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{boost.planName}</span>
                          <span>·</span>
                          <span>{formatCurrency(boost.amountPaid)}</span>
                          <span>·</span>
                          <span>Week {boost.weekNumber}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1 — Plan selection */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-1">Step 1 — Choose a Plan</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Campaigns run Monday–Sunday. Your listing goes into the next available campaign week.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={cn(
                  "text-left p-5 rounded-2xl border-2 transition-all",
                  selectedPlan?.id === plan.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                  </div>
                  {selectedPlan?.id === plan.id && (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  )}
                </div>

                <p className="text-2xl font-serif font-bold text-foreground mb-3">
                  {formatCurrency(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground">/week</span>
                </p>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {plan.platforms.map((p) => {
                    const pc = PLATFORM_CONFIG[p];
                    return (
                      <span key={p} className={cn("text-xs px-2 py-0.5 rounded-full font-medium", pc.bg, pc.color)}>
                        {pc.label}
                      </span>
                    );
                  })}
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>₦{plan.adSpendAllocation.toLocaleString()} goes to actual ad spend</p>
                  <p>Up to {plan.maxListingsPerCampaign} listings per campaign</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Pick listing */}
        {selectedPlan && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-3">Step 2 — Select a Listing to Boost</h2>
            <div className="relative">
              <div
                className="flex items-center gap-2 border border-border rounded-xl px-3 py-2.5 cursor-pointer hover:border-primary/50"
                onClick={() => setShowListingDrop(!showListingDrop)}
              >
                <Search className="w-4 h-4 text-muted-foreground" />
                <span className={cn("flex-1 text-sm", !selectedListing && "text-muted-foreground")}>
                  {selectedListing ? selectedListing.title : "Search your listings..."}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>

              {showListingDrop && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <Input
                      autoFocus
                      value={listingSearch}
                      onChange={(e) => setListingSearch(e.target.value)}
                      placeholder="Type to search..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredListings.length === 0
                      ? <p className="text-sm text-muted-foreground text-center py-4">No active listings found</p>
                      : filteredListings.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => { setSelectedListing(l); setShowListingDrop(false); setListingSearch(""); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 text-left"
                          >
                            {l.images?.[0] && (
                              <img src={l.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
                              <p className="text-xs text-muted-foreground">{l.location.lga}, {l.location.state}</p>
                            </div>
                          </button>
                        ))
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Eligibility */}
        {selectedListing && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              Eligibility Check
              {isCheckingEligibility && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </h2>

            {eligibility && (
              <>
                <div className="space-y-2 mb-4">
                  {(eligibility.checks ?? [{ label: eligibility.reason ?? "Eligible", passed: eligibility.eligible }]).map((c: { label: string; passed: boolean }) => (
                    <div key={c.label} className="flex items-center gap-3">
                      {c.passed
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      }
                      <span className={cn("text-sm", c.passed ? "text-foreground" : "text-red-600")}>
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>

                {eligibility.eligible ? (
                  <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                      This listing qualifies for Ad Boost!
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <p className="text-sm text-red-800 dark:text-red-300">
                      Fix the issues above before boosting this listing.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 4 — Payment */}
        {selectedPlan && eligibility?.eligible && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-3">Step 3 — Pay & Launch</h2>

            <div className="p-4 bg-secondary/50 rounded-xl mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">{selectedPlan.name}</span>
                <span className="font-bold text-foreground">{formatCurrency(selectedPlan.price)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Ad spend allocation</span>
                <span>{formatCurrency(selectedPlan.adSpendAllocation)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Platforms</span>
                <span>{selectedPlan.platforms.map((p) => PLATFORM_CONFIG[p].label).join(", ")}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 rounded-xl mb-4">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>Manual payment:</strong> Transfer <strong>{formatCurrency(selectedPlan.price)}</strong> to
                HomveraX bank account, then enter your payment reference below.
                Admin will verify and activate your campaign within 24 hours.
              </p>
            </div>

            <div className="mb-4">
              <Label>Payment Reference / Transaction ID</Label>
              <Input
                className="mt-1"
                placeholder="e.g. TXN123456789"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>

            <Button
              onClick={handlePurchase}
              disabled={isSubmitting || !paymentRef.trim()}
              className="w-full gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Submit Ad Boost — {formatCurrency(selectedPlan.price)}
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="p-4 bg-secondary/50 border border-border rounded-2xl">
          <div className="flex items-start gap-3">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">How Ad Boost works</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Campaigns run Monday–Sunday. You're added to the next available week</li>
                <li>• Your listing is included in a group campaign of up to 6 properties</li>
                <li>• HomveraX creates professional ad creatives for your listing</li>
                <li>• Weekly performance reports (impressions, clicks, reach) sent to your dashboard</li>
                <li>• Cancellation only available before campaign starts (pending status)</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
