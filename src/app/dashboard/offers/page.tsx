"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Tag, CheckCircle2, X, RefreshCw, Clock, ArrowRight, Shield, MessageSquare, Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  getMyOffers, getReceivedOffers, acceptOffer, rejectOffer, counterOffer,
} from "@/services/offers";
import type { Offer } from "@/services/offers";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "bg-yellow-100 text-yellow-700", icon: Clock },
  accepted:  { label: "Accepted",  color: "bg-green-100 text-green-700",   icon: CheckCircle2 },
  rejected:  { label: "Declined",  color: "bg-red-100 text-red-700",       icon: X },
  countered: { label: "Countered", color: "bg-blue-100 text-blue-700",     icon: RefreshCw },
  paid:      { label: "Paid to Escrow", color: "bg-green-200 text-green-800", icon: CheckCircle2 },
  expired:   { label: "Expired",   color: "bg-gray-100 text-gray-600",     icon: Clock },
};

export default function MyOffersPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "closed">("all");
  const [counterFor, setCounterFor] = useState<Offer | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterNote, setCounterNote] = useState("");
  // ✅ Locks Accept/Counter/Decline for a given offer while a request is in
  // flight — prevents a double-tap (or slow network) from firing the same
  // action twice, which could create duplicate escrow orders downstream.
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isCountering, setIsCountering] = useState(false);

  const load = () => {
    if (!user) return;
    setIsLoading(true);
    const fetcher = role === "buyer" ? getMyOffers(user.id) : getReceivedOffers(user.id);
    fetcher
      .then(setOffers)
      .catch(() => toast.error("Failed to load offers"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [user, role]);

  const filtered = offers.filter((o) => {
    if (filter === "pending") return o.status === "pending";
    if (filter === "closed") return ["accepted", "rejected", "paid", "expired"].includes(o.status);
    return true;
  });

  const handleAccept = async (offer: Offer) => {
    if (processingId) return;
    setProcessingId(offer.id);
    try {
      await acceptOffer(offer.id);
      toast.success("Offer accepted! Buyer can now proceed to escrow.");
      load();
    } catch { toast.error("Failed to accept offer"); }
    finally { setProcessingId(null); }
  };

  const handleReject = async (offer: Offer) => {
    if (processingId) return;
    setProcessingId(offer.id);
    try {
      await rejectOffer(offer.id);
      toast.success("Offer declined");
      load();
    } catch { toast.error("Failed to decline offer"); }
    finally { setProcessingId(null); }
  };

  const handleCounter = async () => {
    if (!counterFor || isCountering) return;
    const price = Number(counterPrice);
    if (!price || price <= 0) { toast.error("Enter a valid price"); return; }
    setIsCountering(true);
    try {
      await counterOffer(counterFor.id, price, counterNote);
      toast.success("Counter-offer sent!");
      setCounterFor(null);
      setCounterPrice("");
      setCounterNote("");
      load();
    } catch { toast.error("Failed to send counter-offer"); }
    finally { setIsCountering(false); }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">My Offers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {role === "buyer" ? "Offers you've made on listings" : "Offers you've received on your listings"}
          </p>
        </div>

        {/* Buyer/Seller toggle */}
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
          {(["buyer", "seller"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                role === r ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "buyer" ? "Offers I made" : "Offers received"}
            </button>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-secondary/50 p-1 rounded-xl w-fit">
        {(["all", "pending", "closed"] as const).map((f) => (
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
          <Tag className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No offers yet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {role === "buyer"
              ? "Offers you make on listings will appear here."
              : "Offers buyers make on your listings will appear here."}
          </p>
          <Link href="/listings">
            <Button>Browse Listings</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isSeller = role === "seller";
            return (
              <div key={o.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Tag className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{o.listingTitle}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isSeller ? `From ${o.buyerName}` : `To ${o.sellerName}`} · {timeAgo(o.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground">{formatCurrency(o.proposedPrice)}</p>
                    {o.originalPrice && o.proposedPrice !== o.originalPrice && (
                      <p className="text-xs text-muted-foreground">Listed at {formatCurrency(o.originalPrice)}</p>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                  </div>
                </div>

                {o.status === "countered" && o.counterPrice && (
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg px-3 py-2 mt-3">
                    <p className="text-xs text-blue-600 font-semibold">Counter-offer</p>
                    <p className="text-sm font-bold text-blue-700">{formatCurrency(o.counterPrice)}</p>
                    {o.counterNote && <p className="text-xs text-blue-500 italic mt-0.5">"{o.counterNote}"</p>}
                  </div>
                )}

                {o.note && (
                  <p className="text-xs text-muted-foreground italic mt-2">"{o.note}"</p>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border flex-wrap gap-2">
                  {/* Seller actions on pending offers */}
                  {isSeller && o.status === "pending" ? (
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700"
                        disabled={processingId === o.id} onClick={() => handleAccept(o)}>
                        {processingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Accept
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1"
                        disabled={processingId === o.id}
                        onClick={() => { setCounterFor(o); setCounterPrice(String(o.proposedPrice)); }}>
                        <RefreshCw className="w-3.5 h-3.5" /> Counter
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        disabled={processingId === o.id} onClick={() => handleReject(o)}>
                        {processingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Decline
                      </Button>
                    </div>
                  ) : !isSeller && o.status === "accepted" ? (
                    <Button size="sm" className="gap-1" asChild>
                      <Link href={`/listings/${o.listingId}?acceptedOffer=${o.id}`}>
                        <Shield className="w-3.5 h-3.5" /> Pay to Escrow <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <span />
                  )}

                  <Link href={`/messages?conversation=${o.conversationId ?? ""}`} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                    <MessageSquare className="w-3.5 h-3.5" /> Open chat
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Counter-offer modal */}
      {counterFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-serif font-bold text-foreground mb-1">Counter-offer</h3>
            <p className="text-xs text-muted-foreground mb-4">{counterFor.listingTitle}</p>
            <label className="text-xs font-medium text-muted-foreground">Your counter price (₦)</label>
            <input
              type="number"
              value={counterPrice}
              onChange={(e) => setCounterPrice(e.target.value)}
              className="w-full mt-1 mb-3 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
            <textarea
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              rows={2}
              className="w-full mt-1 mb-4 rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCounterFor(null)} disabled={isCountering}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={handleCounter} disabled={isCountering}>
                {isCountering ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Send counter
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
