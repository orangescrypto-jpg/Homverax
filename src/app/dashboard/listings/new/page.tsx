"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertCircle, CheckCircle2, Clock, Copy,
  Flame, Loader2, Rocket, Star, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getMyListings } from "@/services/listings";
import { getPlatformConfig } from "@/services/platformSettings";
// ✅ FIX: Use service layer — no direct applyBoost until admin approves payment
import { submitBoostPayment } from "@/services/subscriptions";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPriceLabel, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PropertyListing, ListingBoostType } from "@/types";
import type { ListingBoostOption } from "@/types";
import type { BankDetails } from "@/services/platformSettings";

const BOOST_ICONS: Record<string, React.ElementType> = {
  none: X, featured: Star, top_placement: Rocket, urgent: Flame,
};

export default function BoostListingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("id");

  const [listings, setListings]           = useState<PropertyListing[]>([]);
  const [boostOptions, setBoostOptions]   = useState<ListingBoostOption[]>([]);
  const [bank, setBank]                   = useState<BankDetails | null>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [selectedListingId, setSelectedListingId] = useState(preselectedId ?? "");
  const [selectedBoost, setSelectedBoost] = useState<ListingBoostType>("none");

  // Payment proof flow
  const [showPayment, setShowPayment]   = useState(false);
  const [proofFile, setProofFile]       = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted]       = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyListings(user.id),
      getPlatformConfig(),
    ])
      .then(([l, cfg]) => {
        setListings(l);
        setBoostOptions(cfg.boostOptions);
        setBank(cfg.bank);
        if (!preselectedId && l.length > 0) setSelectedListingId(l[0].id);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setIsLoading(false));
  }, [user, preselectedId]);

  const selectedListing = listings.find((l) => l.id === selectedListingId);
  const selectedOption  = boostOptions.find((o) => o.type === selectedBoost);
  const paidOptions     = boostOptions.filter((o) => o.type !== "none" && o.price > 0);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // ✅ FIX: Boost requires payment — submit proof, admin approves, then boost applies
  const handleSubmitPayment = async () => {
    if (!user || !selectedListingId || !selectedListing || !selectedOption) return;
    if (!proofFile) { toast.error("Attach your payment proof to proceed"); return; }

    setIsSubmitting(true);
    try {
      await submitBoostPayment({
        userId:       user.id,
        listingId:    selectedListingId,
        listingTitle: selectedListing.title,
        boostType:    selectedBoost,
        boostLabel:   selectedOption.label,
        amount:       selectedOption.price,
        proofFile,
      });
      setSubmitted(true);
      toast.success("Boost payment submitted! Admin will activate within 24 hours.");
    } catch {
      toast.error("Submission failed. Please contact support.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto text-center py-16">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Boost Payment Submitted!</h1>
          <p className="text-muted-foreground mb-1">
            Your <strong>{selectedOption?.label}</strong> boost for{" "}
            <strong>{selectedListing?.title}</strong> has been submitted.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Admin will verify your payment and activate the boost within 24 hours.
            You'll get a notification when it goes live.
          </p>
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Clock className="w-4 h-4" /> Pending admin verification
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push("/dashboard/listings")}>
              View My Listings
            </Button>
            <Button variant="outline" onClick={() => { setSubmitted(false); setShowPayment(false); setProofFile(null); }}>
              Boost Another
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-foreground">Boost a Listing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Get more views and inquiries by boosting visibility.
          </p>
        </div>

        {/* How it works notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">How boosting works</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Select a boost, make a bank transfer, attach proof and submit.
              Admin activates your boost within 24 hours. Boosts run for 7 days.
            </p>
          </div>
        </div>

        {/* Select listing */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-5">
          <h3 className="font-semibold text-foreground mb-3">Select Listing</h3>
          {isLoading ? (
            <div className="skeleton h-10 rounded-lg" />
          ) : listings.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No listings yet.{" "}
              <button onClick={() => router.push("/dashboard/listings/new")} className="text-primary underline">
                Create one first
              </button>
            </div>
          ) : (
            <Select value={selectedListingId} onValueChange={setSelectedListingId}>
              <SelectTrigger><SelectValue placeholder="Choose a listing" /></SelectTrigger>
              <SelectContent>
                {listings.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title} — {formatPriceLabel(l.price, l.priceUnit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedListing && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current boost:</span>
              <span className={cn(
                "font-medium capitalize px-2 py-0.5 rounded-full text-xs",
                selectedListing.boostType && selectedListing.boostType !== "none"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
              )}>
                {selectedListing.boostType?.replace("_", " ") ?? "None"}
              </span>
            </div>
          )}
        </div>

        {/* Boost options */}
        {!showPayment ? (
          <>
            <div className="space-y-3 mb-6">
              {paidOptions.map((option) => {
                const Icon = BOOST_ICONS[option.type] ?? Star;
                const isSelected = selectedBoost === option.type;
                return (
                  <button
                    key={option.type}
                    onClick={() => setSelectedBoost(option.type as ListingBoostType)}
                    className={cn(
                      "w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary" : "bg-secondary"
                    )}>
                      <Icon className={cn("w-5 h-5", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">{option.label}</p>
                        <p className="font-bold text-foreground">{formatCurrency(option.price)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>

            <Button
              className="w-full h-12 font-semibold gap-2"
              disabled={!selectedListingId || isLoading}
              onClick={() => setShowPayment(true)}
            >
              <Star className="w-4 h-4" />
              Proceed to Pay
              {selectedOption && selectedOption.price > 0 && ` · ${formatCurrency(selectedOption.price)}`}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Boosts are active for 7 days after admin verification.
            </p>
          </>
        ) : (
          /* Payment proof section */
          bank && selectedOption && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">
                  Pay for {selectedOption.label}
                </h2>
                <button onClick={() => setShowPayment(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bank details */}
              <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Bank Transfer Details
                </p>
                {[
                  { label: "Bank Name",      value: bank.bankName },
                  { label: "Account Number", value: bank.accountNumber },
                  { label: "Account Name",   value: bank.accountName },
                  { label: "Amount",         value: formatCurrency(selectedOption.price) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-semibold text-foreground text-sm">{value}</p>
                    </div>
                    <button onClick={() => copyText(value, label)} className="p-2 rounded-lg hover:bg-background">
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {bank.bankNote && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{bank.bankNote}</p>
                )}
              </div>

              {/* Proof upload */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">
                  Attach Payment Proof <span className="text-red-500">*</span>
                </p>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground mt-1">Screenshot or PDF of your bank receipt</p>
              </div>

              {/* Summary */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm">
                <p className="font-semibold text-foreground mb-1">Boost Summary</p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Listing:</span>
                  <span className="font-medium text-foreground truncate max-w-[60%]">{selectedListing?.title}</span>
                </div>
                <div className="flex justify-between text-muted-foreground mt-1">
                  <span>Boost type:</span>
                  <span className="font-medium text-foreground">{selectedOption.label}</span>
                </div>
                <div className="flex justify-between text-muted-foreground mt-1">
                  <span>Duration:</span>
                  <span className="font-medium text-foreground">7 days</span>
                </div>
                <div className="flex justify-between font-bold text-primary mt-1 pt-1 border-t border-primary/20">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedOption.price)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2"
                  onClick={handleSubmitPayment}
                  disabled={isSubmitting || !proofFile}
                >
                  {isSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : "Submit Payment"
                  }
                </Button>
                <Button variant="outline" onClick={() => { setShowPayment(false); setProofFile(null); }}>
                  Back
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
