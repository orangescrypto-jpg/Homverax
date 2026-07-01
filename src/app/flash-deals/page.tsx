"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Flame, Tag, ArrowRight, Zap } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { getActiveFlashDeals } from "@/services/flashDeals";
import { formatCurrency, cn } from "@/lib/utils";
import type { FlashDeal } from "@/services/flashDeals";

function Countdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState({ h: 0, m: 0, s: 0, expired: false });

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining({ h: 0, m: 0, s: 0, expired: true }); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining({ h, m, s, expired: false });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  if (remaining.expired) return (
    <span className="text-xs text-red-500 font-semibold">Deal Ended</span>
  );

  const urgency = remaining.h < 2;
  return (
    <div className={cn("flex items-center gap-1 text-xs font-bold", urgency ? "text-red-600" : "text-amber-600")}>
      <Clock className="w-3.5 h-3.5" />
      <span className="font-mono">
        {String(remaining.h).padStart(2, "0")}:{String(remaining.m).padStart(2, "0")}:{String(remaining.s).padStart(2, "0")}
      </span>
      <span className="font-normal text-muted-foreground">left</span>
    </div>
  );
}

const PLACEHOLDER = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=70";

export default function FlashDealsPage() {
  const [deals, setDeals]     = useState<FlashDeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getActiveFlashDeals(50)
      .then(setDeals)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-red-600 via-orange-500 to-amber-500 text-white py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Flame className="w-7 h-7 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-widest opacity-90">Time-Limited</span>
            <Flame className="w-7 h-7 animate-pulse" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-3">Flash Deals</h1>
          <p className="text-lg opacity-90">
            Discounted properties for a limited time. Don't miss out.
          </p>
          <p className="text-sm opacity-70 mt-1">
            {deals.length} active deal{deals.length !== 1 ? "s" : ""} right now
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-80 rounded-2xl" />)}
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-24">
            <Zap className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">No active deals right now</h2>
            <p className="text-muted-foreground mb-6">
              Check back soon — agents add new flash deals daily.
            </p>
            <Link href="/listings">
              <Button className="gap-2">
                <ArrowRight className="w-4 h-4" /> Browse All Listings
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {deals.map((deal) => (
              <Link key={deal.listingId} href={`/listings/${deal.listingId}`}>
                <div className="bg-card border-2 border-red-200 dark:border-red-800/40 rounded-2xl overflow-hidden hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer">
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={deal.images?.[0] ?? PLACEHOLDER}
                      alt={deal.listingTitle}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                    {/* Discount badge */}
                    <div className="absolute top-3 left-3 bg-red-600 text-white text-sm font-black px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      -{deal.discountPercent}%
                    </div>
                    {/* Flash icon */}
                    <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 w-8 h-8 rounded-full flex items-center justify-center shadow">
                      <Flame className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground truncate mb-1">
                      {deal.listingTitle}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      {deal.location?.lga ? `${deal.location.lga}, ` : ""}
                      {deal.location?.state ?? "Nigeria"}
                    </p>

                    {/* Pricing */}
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-xl font-serif font-bold text-red-600">
                        {formatCurrency(deal.flashPrice)}
                      </span>
                      <span className="text-sm text-muted-foreground line-through pb-0.5">
                        {formatCurrency(deal.originalPrice)}
                      </span>
                      {deal.priceUnit && (
                        <span className="text-xs text-muted-foreground pb-0.5">
                          /{deal.priceUnit}
                        </span>
                      )}
                    </div>

                    {/* Countdown */}
                    <div className="flex items-center justify-between">
                      <Countdown endsAt={deal.endsAt} />
                      <span className="text-xs text-primary font-semibold">
                        View Deal →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
