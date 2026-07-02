"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bath, Bed, Building2, Heart, MapPin, Maximize2, Star, Rocket, Flame, Eye, CheckCircle2, Shield } from "lucide-react";
import { cn, formatPriceLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPlatformConfig } from "@/services/platformSettings";
import type { PropertyListing } from "@/types";

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&q=80",
];

const BOOST_CONFIG = {
  featured: { label: "Featured", icon: Star, color: "bg-accent text-accent-foreground" },
  top_placement: { label: "Top Pick", icon: Rocket, color: "bg-primary text-primary-foreground" },
  urgent: { label: "Urgent", icon: Flame, color: "bg-red-500 text-white" },
  none: null,
};

interface ListingCardProps {
  listing: PropertyListing;
  onSave?: (id: string) => void;
  isSaved?: boolean;
  compact?: boolean;
  // ✅ FIX: HomeClient.tsx passes this prop but it wasn't declared here.
  // Styling for featured listings is already derived from
  // listing.boostType below, so this is accepted just to avoid a
  // type-check mismatch — no separate behavior needed.
  featured?: boolean;
}

export default function ListingCard({ listing, onSave, isSaved, compact }: ListingCardProps) {
  // ✅ FIX: badge now shows the REAL admin-configured buyer fee percent
  // (getPlatformConfig() is cached after the first call, so this doesn't
  // add a network request per card after the first one on the page).
  const [buyerFeePercent, setBuyerFeePercent] = useState<number | null>(null);
  useEffect(() => {
    getPlatformConfig().then((cfg) => {
      setBuyerFeePercent(cfg.escrowFees?.buyerServiceChargePercent ?? null);
    }).catch(() => {});
  }, []);

  const imageUrl =
    listing.images?.[0] ??
    PLACEHOLDER_IMAGES[Math.abs(listing.id.charCodeAt(0) % PLACEHOLDER_IMAGES.length)];

  const boost = BOOST_CONFIG[listing.boostType ?? "none"];
  const isFeatured = listing.boostType === "featured";
  const priceLabel = formatPriceLabel(listing.price, listing.priceUnit);

  const propertyTypeLabel: Record<string, string> = {
    apartment: "Apartment", house: "House", duplex: "Duplex",
    flat: "Flat", room: "Room", land: "Land", commercial: "Commercial",
    shortlet: "Shortlet", cleaning: "Cleaning", repairs: "Repairs",
    installation: "Installation", logistics: "Logistics", other: "Service",
  };
  // ✅ FIX: this map only covered a handful of values, so anything from
  // LAND_TYPES/COMMERCIAL_TYPES/SHORTLET_TYPES/etc (e.g.
  // "residential_land") fell through to the raw snake_case value being
  // shown as-is. Instead of hand-maintaining every possible type here
  // (which will always drift out of sync as new type lists get added),
  // auto-format any unmapped value into readable Title Case.
  const formatTypeLabel = (value?: string) => {
    if (!value) return "";
    return propertyTypeLabel[value] ?? value
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <div
      className={cn(
        "group relative bg-card rounded-2xl overflow-hidden border border-border hover:shadow-lg transition-all duration-200",
        isFeatured && "ring-2 ring-accent"
      )}
    >
      {/* Image */}
      <Link href={`/listings/${listing.id}`} className="block">
        <div className="relative overflow-hidden aspect-[4/3]">
          <Image
            src={imageUrl}
            alt={listing.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />

          {/* Boost badge */}
          {boost && (
            <div className={cn("absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold", boost.color)}>
              <boost.icon className="w-3 h-3" />
              {boost.label}
            </div>
          )}

          {/* Verified badge */}
          {listing.isPropertyVerified && (
            <div className="absolute top-3 right-12 badge-verified text-xs">
              <CheckCircle2 className="h-3 w-3" /> Verified
            </div>
          )}

          {/* Save button */}
          {onSave && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSave(listing.id);
              }}
              className={cn(
                "absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                isSaved
                  ? "bg-red-500 text-white"
                  : "bg-white/90 text-muted-foreground hover:text-red-500"
              )}
            >
              <Heart className={cn("w-4 h-4", isSaved && "fill-current")} />
            </button>
          )}

          {/* Views */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
            <Eye className="w-3 h-3" />
            {listing.viewsCount.toLocaleString()}
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <Badge variant="secondary" className="text-xs shrink-0">
            {formatTypeLabel(listing.propertyType)}
          </Badge>
        </div>

        <Link href={`/listings/${listing.id}`}>
          <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 hover:text-primary transition-colors mt-1">
            {listing.title}
          </h3>
        </Link>

        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{listing.location.lga}, {listing.location.state}</span>
        </div>

        {/* Price */}
        <p className="mt-2 text-lg font-bold text-primary font-serif">
          {priceLabel}
        </p>

        {/* ✅ Escrow Protected badge — shown directly on the card, before
            the listing is even opened, so buyers see the trust signal
            immediately while browsing (not just after clicking in). Fee
            text reads the real admin-configured buyer fee percent. */}
        <div className="mt-2 flex items-center justify-between gap-1.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 rounded-lg px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Escrow Protected</span>
          </div>
          {buyerFeePercent !== null && (
            <span className="text-[11px] text-green-600/80 dark:text-green-400/70 shrink-0">
              {buyerFeePercent}% buyer fee
            </span>
          )}
        </div>

        {/* Property specs */}
        {(listing.bedrooms !== undefined || listing.bathrooms !== undefined) && (
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {listing.bedrooms !== undefined && (
              <span className="flex items-center gap-1">
                <Bed className="w-3.5 h-3.5" /> {listing.bedrooms} bed{listing.bedrooms !== 1 ? "s" : ""}
              </span>
            )}
            {listing.bathrooms !== undefined && (
              <span className="flex items-center gap-1">
                <Bath className="w-3.5 h-3.5" /> {listing.bathrooms} bath
              </span>
            )}
            {listing.areaSqM && (
              <span className="flex items-center gap-1">
                <Maximize2 className="w-3.5 h-3.5" /> {listing.areaSqM}m²
              </span>
            )}
          </div>
        )}

        {/* Agent */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{listing.agent?.name}</span>
            {listing.agent?.isVerified && (
              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            )}
          </div>
          <Link href={`/listings/${listing.id}`}>
            <Button size="sm" variant="outline" className="h-7 text-xs px-3">
              View
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
