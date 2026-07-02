"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, Bath, Bed, Building2, Calendar,
  CheckCircle2, ChevronLeft, ChevronRight, Eye,
  Heart, Loader2, MapPin, Maximize2, MessageSquare,
  Phone, Share2, Shield, Star, X, ZoomIn, Zap, Clock,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Lightbox from "@/components/features/Lightbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getListingById, saveListing, unsaveListing, isListingSaved } from "@/services/listings";
import { createBooking } from "@/services/bookings";
import { startConversation, sendMessage } from "@/services/messages";
import { useAuth } from "@/hooks/useAuth";
import { useCountdown } from "@/hooks/useCountdown";
import { formatPriceLabel, formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PropertyListing } from "@/types";
import { getPlatformConfig } from "@/services/platformSettings";
import { getAcceptedOffer, markOfferPaid } from "@/services/offers";
import { initiateEscrow } from "@/services/escrow";
import { useSearchParams } from "next/navigation";
import type { Offer } from "@/services/offers";

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
];

export default function ListingDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(1.5);
  const searchParams = useSearchParams();
  // ── Negotiation → escrow flow ──────────────────────────────────────────
  // acceptedOffer: set when buyer arrives with an accepted offer from chat
  // If null, buyer pays listing.price directly (Flow B)
  const [acceptedOffer, setAcceptedOffer] = useState<Offer | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [isInitiatingEscrow, setIsInitiatingEscrow] = useState(false);

  // ✅ FIX: flash deal badge/price had no live countdown anywhere on this
  // page. Hook is called unconditionally (before the `if (!listing)`
  // early return below) since listing may still be null on first render.
  const countdown = useCountdown(listing?.isFlashDeal ? listing.flashDealExpiresAt : null);

  // Booking form
  const [bookingMessage, setBookingMessage] = useState("");
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // Message form
  const [messageText, setMessageText] = useState("");
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [data, cfg] = await Promise.all([
          getListingById(id),
          getPlatformConfig(),
        ]);
        setListing(data);
        // ✅ FIX: `cfg.platformFeePercent` doesn't exist on PlatformConfig —
        // it's always undefined, so this silently kept the hardcoded
        // useState(1.5) default forever. The buyer-facing checkout fee
        // should come from cfg.escrowFees.buyerServiceChargePercent, which
        // is what admins actually control in Settings (separate from the
        // seller-side fees the seller sees while listing).
        setPlatformFeePercent(cfg.escrowFees?.buyerServiceChargePercent ?? 1.0);
        if (isAuthenticated && user && data) {
          const saved = await isListingSaved(user.id, data.id);
          setIsSaved(saved);
          // ✅ Check for accepted offer from chat (Flow A)
          // URL may carry ?acceptedOffer=offerId when buyer taps "Pay to Escrow" in chat
          const urlOfferId = searchParams.get("acceptedOffer");
          if (urlOfferId) {
            setOfferLoading(true);
            const offer = await getAcceptedOffer(data.id, user.id).catch(() => null);
            if (offer && offer.status === "accepted") {
              setAcceptedOffer(offer);
            }
            setOfferLoading(false);
          }
        }
      } catch {
        toast.error("Failed to load listing");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id, isAuthenticated, user]);

  const handleSave = async () => {
    if (!isAuthenticated || !user) { router.push("/login"); return; }
    if (!listing) return;
    try {
      if (isSaved) {
        await unsaveListing(user.id, listing.id);
        setIsSaved(false);
        toast.success("Removed from saved");
      } else {
        await saveListing(user.id, listing.id);
        setIsSaved(true);
        toast.success("Saved!");
      }
    } catch { toast.error("Failed to save"); }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: listing?.title, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  };

  const handleBooking = async () => {
    if (!isAuthenticated || !user) { router.push("/login"); return; }
    if (!listing) return;
    if (!bookingMessage.trim()) { toast.error("Add a message for the agent"); return; }
    setIsBooking(true);
    try {
      const booking = await createBooking({
        listingId: listing.id,
        listingTitle: listing.title,
        listingImage: listing.images?.[0] ?? "",
        listingPrice: listing.price,
        buyerId: user.id,
        sellerId: listing.agentId,
        message: bookingMessage.trim(),
      });
      toast.success("Booking request sent! Check My Bookings for updates.");
      setShowBookingForm(false);
      setBookingMessage("");
      router.push("/dashboard/bookings");
    } catch {
      toast.error("Failed to send booking. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!isAuthenticated || !user) { router.push("/login"); return; }
    if (!listing || !messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      const conversation = await startConversation(
        [
          { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
          { id: listing.agentId, name: listing.agent?.name ?? "Agent", avatarUrl: listing.agent?.avatarUrl },
        ],
        listing.id,
        listing.title,
        listing.price,        // ✅ pass listing price for offer modal prefill
        listing.agentId       // ✅ pass seller id so chat knows who the seller is
      );
      await sendMessage(conversation.id, user.id, listing.agentId, messageText.trim());
      toast.success("Message sent! View it in Messages.");
      setShowMessageForm(false);
      setMessageText("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  // ── Initiate escrow — handles both Flow A (negotiated) and Flow B (direct) ──
  const handleInitiateEscrow = async (useNegotiatedPrice: boolean) => {
    if (!isAuthenticated || !user) { router.push("/login"); return; }
    if (!listing) return;
    setIsInitiatingEscrow(true);
    try {
      const amount = useNegotiatedPrice && acceptedOffer
        ? acceptedOffer.proposedPrice   // Flow A — use negotiated price
        : effectivePrice;               // Flow B — use flash deal price if active, else listing price

      const escrow = await initiateEscrow({
        listingId:     listing.id,
        listingTitle:  listing.title,
        listingImage:  listing.images?.[0] ?? "",
        listingPrice:  effectivePrice,
        listingLocation: listing.location?.lga ?? listing.location?.state ?? "",
        listingType:   listing.listingType,
        buyerId:       user.id,
        sellerId:      listing.agentId,
        amount,
      });

      // If this came from an accepted offer, mark the offer as paid
      if (useNegotiatedPrice && acceptedOffer) {
        await markOfferPaid(acceptedOffer.id, escrow.id);
      }

      setShowBuyModal(false);
      toast.success("Escrow initiated! Complete payment to secure the deal.");
      router.push(`/dashboard/escrow/${escrow.id}`);
    } catch {
      toast.error("Failed to initiate escrow. Please try again.");
    } finally {
      setIsInitiatingEscrow(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="skeleton h-96 rounded-2xl mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="skeleton h-8 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-32 rounded" />
            </div>
            <div className="skeleton h-72 rounded-2xl" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h1 className="text-2xl font-serif font-bold mb-2">Listing Not Found</h1>
          <Button onClick={() => router.push("/listings")}>Browse Listings</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const images = listing.images?.length ? listing.images : PLACEHOLDER_IMAGES;
  // ✅ FIX: flash deal price/expiry reached this page's data but was never
  // used — every price display, fee calc, and the actual escrow amount
  // was hardcoded to listing.price. effectivePrice is the single source
  // of truth used everywhere below (display, fee math, Buy Now modal,
  // and the amount actually sent to initiateEscrow).
  const showFlashDeal = listing.isFlashDeal && !countdown.expired;
  // ✅ FIX: button always said "Buy Now" even for rentals/shortlets/services,
  // which doesn't make sense when you're paying rent or booking a service.
  // Use a verb that matches the listing type; escrow protection applies
  // to all of them, so the "— Escrow Protected" suffix stays generic.
  const ctaVerb =
    listing.listingType === "rent" ? "Pay Rent"
    : listing.listingType === "shortlet" ? "Book Now"
    : listing.listingType === "service" ? "Hire Now"
    : "Buy Now";
  const effectivePrice =
    showFlashDeal && listing.flashDealPrice != null
      ? listing.flashDealPrice
      : listing.price;
  const platformFee = Math.round((effectivePrice * platformFeePercent) / 100);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={images}
          activeIndex={activeImage}
          onClose={() => setLightboxOpen(false)}
          onNext={() => setActiveImage((i) => (i + 1) % images.length)}
          onPrev={() => setActiveImage((i) => (i - 1 + images.length) % images.length)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/listings" className="flex items-center gap-1 hover:text-primary transition-colors">
            <ChevronLeft className="w-4 h-4" /> All Listings
          </Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{listing.title}</span>
        </div>

        {/* Image Gallery */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 rounded-2xl overflow-hidden mb-4 h-[360px] lg:h-[480px]">
          <div className="lg:col-span-2 relative group cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
            <Image
              src={images[activeImage]}
              alt={listing.title}
              fill className="object-cover"
              priority sizes="(max-width: 1024px) 100vw, 66vw"
            />
            {/* Zoom hint */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-sm">
                <ZoomIn className="w-4 h-4" /> View fullscreen
              </div>
            </div>
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveImage((i) => (i - 1 + images.length) % images.length); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveImage((i) => (i + 1) % images.length); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {/* Photo count badge */}
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <Eye className="w-3 h-3" /> {images.length} photo{images.length !== 1 ? "s" : ""}
            </div>
          </div>
          {images.length > 1 && (
            <div className="hidden lg:flex flex-col gap-2">
              {images.slice(1, 3).map((img, i) => (
                <div
                  key={i}
                  className="relative flex-1 cursor-zoom-in group"
                  onClick={() => { setActiveImage(i + 1); setLightboxOpen(true); }}
                >
                  <Image src={img} alt="" fill className="object-cover group-hover:brightness-90 transition-all" sizes="33vw" />
                  {i === 1 && images.length > 3 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">+{images.length - 3}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={cn("relative w-20 h-14 rounded-lg shrink-0 overflow-hidden border-2 transition-all",
                  activeImage === i ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <Image src={img} alt="" fill className="object-cover" sizes="80px" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="secondary">{listing.propertyType}</Badge>
                  <Badge variant="outline" className="capitalize">{listing.listingType}</Badge>
                  {listing.isPropertyVerified && (
                    <span className="badge-verified"><CheckCircle2 className="h-3 w-3" /> Verified</span>
                  )}
                  {listing.isFeatured && (
                    <Badge className="bg-accent text-accent-foreground">
                      <Star className="w-3 h-3 mr-1" /> Featured
                    </Badge>
                  )}
                  {showFlashDeal && (
                    <Badge className="bg-orange-500 text-white hover:bg-orange-500">
                      <Zap className="w-3 h-3 mr-1" /> Flash Deal
                      {countdown.label && (
                        <span className="ml-1.5 inline-flex items-center gap-1 opacity-90">
                          <Clock className="w-3 h-3" /> {countdown.label}
                        </span>
                      )}
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl font-serif font-bold text-foreground">{listing.title}</h1>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="icon" onClick={handleSave} className={cn(isSaved && "text-red-500 border-red-200 bg-red-50")}>
                  <Heart className={cn("w-4 h-4", isSaved && "fill-current")} />
                </Button>
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground mb-4">
              <MapPin className="w-4 h-4" />
              <span>{listing.location.address}, {listing.location.lga}, {listing.location.state}</span>
            </div>

            {showFlashDeal && listing.flashDealPrice != null ? (
              <div className="flex items-center gap-3 flex-wrap mb-6">
                <p className="text-3xl font-serif font-bold text-orange-600">
                  {formatPriceLabel(listing.flashDealPrice, listing.priceUnit)}
                </p>
                <p className="text-lg text-muted-foreground line-through">
                  {formatPriceLabel(listing.price, listing.priceUnit)}
                </p>
                <span className="flex items-center gap-1 text-xs font-bold text-white bg-orange-500 px-2 py-1 rounded-lg">
                  <Zap className="w-3 h-3" />
                  -{Math.round(((listing.price - listing.flashDealPrice) / listing.price) * 100)}%
                </span>
                {countdown.label && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3" />
                    Ends in {countdown.label}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-3xl font-serif font-bold text-primary mb-6">
                {formatPriceLabel(listing.price, listing.priceUnit)}
              </p>
            )}

            {/* Specs */}
            {(listing.bedrooms !== undefined || listing.bathrooms !== undefined) && (
              <div className="flex flex-wrap gap-4 p-4 bg-secondary/50 rounded-2xl mb-6">
                {listing.bedrooms !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bed className="w-4 h-4 text-primary" />
                    <span><strong>{listing.bedrooms}</strong> Bedroom{listing.bedrooms !== 1 ? "s" : ""}</span>
                  </div>
                )}
                {listing.bathrooms !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bath className="w-4 h-4 text-primary" />
                    <span><strong>{listing.bathrooms}</strong> Bathroom{listing.bathrooms !== 1 ? "s" : ""}</span>
                  </div>
                )}
                {listing.areaSqM && (
                  <div className="flex items-center gap-2 text-sm">
                    <Maximize2 className="w-4 h-4 text-primary" />
                    <span><strong>{listing.areaSqM}</strong> m²</span>
                  </div>
                )}
                {listing.furnished !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>{listing.furnished ? "Furnished" : "Unfurnished"}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mb-8">
              <h2 className="font-semibold text-foreground mb-3">About this property</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{listing.description}</p>
            </div>

            {/* Escrow info */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Escrow-Protected Transaction</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Your payment is held securely by HomveraX until you confirm the property is as described.
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {showFlashDeal && listing.flashDealPrice != null ? "Flash deal price" : "Listing price"}
                  </span>
                  <span className="font-medium">{formatCurrency(effectivePrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Escrow fee ({platformFeePercent}%)</span>
                  <span className="font-medium">{formatCurrency(platformFee)}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-primary pt-1 border-t border-primary/20">
                  <span>Total</span>
                  <span>{formatCurrency(effectivePrice + platformFee)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Agent card */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Listed by</h3>
              <Link href={`/agents/${listing.agentId}`} className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {listing.agent?.name?.charAt(0) ?? "A"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-foreground">{listing.agent?.name}</p>
                    {listing.agent?.isVerified && <BadgeCheck className="w-4 h-4 text-green-500" />}
                  </div>
                  <p className="text-xs text-primary hover:underline">View profile →</p>
                </div>
              </Link>

              <div className="space-y-2">
                {/* ✅ Flow A: accepted offer → pay negotiated price */}
                {acceptedOffer ? (
                  <Button
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={isInitiatingEscrow || offerLoading}
                    onClick={() => handleInitiateEscrow(true)}
                  >
                    {isInitiatingEscrow
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                      : <><Shield className="w-4 h-4" /> Pay {formatCurrency(acceptedOffer.proposedPrice)} to Escrow</>
                    }
                  </Button>
                ) : (
                  /* ✅ Flow B: no offer → direct purchase at listing price */
                  <Button
                    className="w-full gap-2"
                    disabled={isInitiatingEscrow}
                    onClick={() => setShowBuyModal(true)}
                  >
                    <Shield className="w-4 h-4" />
                    {showFlashDeal && listing.flashDealPrice != null
                      ? <>{ctaVerb} — {formatCurrency(listing.flashDealPrice)} <Zap className="w-3.5 h-3.5" /></>
                      : `${ctaVerb} — Escrow Protected`}
                  </Button>
                )}

                <Button className="w-full gap-2" variant="outline" onClick={() => setShowBookingForm(!showBookingForm)}>
                  <Calendar className="w-4 h-4" />
                  {showBookingForm ? "Cancel Booking" : "Request Viewing"}
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={() => setShowMessageForm(!showMessageForm)}>
                  <MessageSquare className="w-4 h-4" />
                  {showMessageForm ? "Cancel" : "Message & Negotiate"}
                </Button>
                {listing.agent?.phone && (
                  <Button variant="outline" className="w-full gap-2" asChild>
                    <a href={`tel:${listing.agent.phone}`}>
                      <Phone className="w-4 h-4" /> Call Agent
                    </a>
                  </Button>
                )}
              </div>

              {/* Booking form */}
              {showBookingForm && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <p className="text-sm font-medium text-foreground">Request a viewing or booking</p>
                  <Textarea
                    placeholder="Introduce yourself, mention your move-in date, and any questions…"
                    value={bookingMessage}
                    onChange={(e) => setBookingMessage(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={isBooking || !bookingMessage.trim()}
                    onClick={handleBooking}
                  >
                    {isBooking ? "Sending…" : "Send Booking Request"}
                  </Button>
                </div>
              )}

              {/* Message form */}
              {showMessageForm && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <p className="text-sm font-medium text-foreground">Message the agent</p>
                  <Textarea
                    placeholder="Ask about the property, availability, or pricing…"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                  <Button
                    className="w-full"
                    variant="outline"
                    size="sm"
                    disabled={isSendingMessage || !messageText.trim()}
                    onClick={handleSendMessage}
                  >
                    {isSendingMessage ? "Sending…" : "Send Message"}
                  </Button>
                </div>
              )}
            </div>

            {/* ✅ FIX: Safety Tip moved to appear right after the action
                buttons (Buy Now / Request Viewing / Message), instead of
                after Listing stats — it's more relevant right where the
                person is about to act on payment. */}
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">Safety Tip</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300/80">
                    Always use HomveraX escrow for payments. Never pay directly before verifying the property.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm">Listing stats</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-foreground">{listing.viewsCount}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{listing.inquiriesCount}</p>
                  <p className="text-xs text-muted-foreground">Inquiries</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{listing.savedCount}</p>
                  <p className="text-xs text-muted-foreground">Saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Buy Now modal — Flow B direct purchase confirmation */}
      {showBuyModal && listing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Confirm {ctaVerb === "Pay Rent" ? "Rent Payment" : ctaVerb === "Book Now" ? "Booking" : ctaVerb === "Hire Now" ? "Hire" : "Purchase"}</h3>
              <button onClick={() => setShowBuyModal(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {showFlashDeal && listing.flashDealPrice != null
                ? "You are about to initiate an escrow-protected transaction at the discounted flash deal price."
                : "You are about to initiate an escrow-protected transaction at the full listing price."}{" "}
              Your payment is held securely until you confirm delivery.
            </p>
            <div className="bg-secondary/50 rounded-xl p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {showFlashDeal && listing.flashDealPrice != null ? "Flash deal price" : "Listing price"}
                </span>
                <span className="font-semibold">{formatCurrency(effectivePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Escrow fee ({platformFeePercent}%)</span>
                <span className="font-medium">{formatCurrency(Math.round(effectivePrice * platformFeePercent / 100))}</span>
              </div>
              <div className="flex justify-between font-bold text-primary pt-1 border-t border-primary/20">
                <span>Total</span>
                <span>{formatCurrency(effectivePrice + Math.round(effectivePrice * platformFeePercent / 100))}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              💬 Want to negotiate the price first?{" "}
              <button
                className="text-primary font-medium underline"
                onClick={() => { setShowBuyModal(false); setShowMessageForm(true); }}
              >
                Message the seller
              </button>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowBuyModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={isInitiatingEscrow}
                onClick={() => handleInitiateEscrow(false)}
              >
                {isInitiatingEscrow
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  : <><Shield className="w-4 h-4" /> Confirm & Pay</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
