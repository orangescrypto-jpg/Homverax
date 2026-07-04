"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, Building2, ChevronLeft, Loader2,
  MessageSquare, Star, User,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ListingCard from "@/components/features/ListingCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
// ✅ FIX: Use getUserById from auth service instead of direct getDoc(db, "users", agentId)
import { getUserById } from "@/services/auth";
import { getPlatformConfig } from "@/services/platformSettings";
import { getMyListings } from "@/services/listings";
import { getAgentReviews, createReview, hasReviewed } from "@/services/reviews";
import { startConversation, sendMessage } from "@/services/messages";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_CONFIG } from "@/lib/roles";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { HomveraxUser, PropertyListing } from "@/types";
import type { Review } from "@/services/reviews";

function StarRating({
  rating,
  onChange,
  readonly = false,
}: {
  rating: number;
  onChange?: (r: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={cn("transition-colors", readonly ? "cursor-default" : "cursor-pointer")}
        >
          <Star
            className={cn(
              "w-5 h-5 transition-colors",
              (hovered || rating) >= star
                ? "fill-accent text-accent"
                : "text-border"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function AgentProfileClient({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [agent, setAgent] = useState<HomveraxUser | null>(null);
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  // ✅ FIX: gate review UI by enableReviewsAndRatings flag
  const [reviewsEnabled, setReviewsEnabled] = useState(true);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Agent profiles are login-gated — only listing pages stay public.
  // Wait for auth to finish initializing (authLoading) before redirecting,
  // so a logged-in user isn't bounced to /login on a page refresh while
  // their session is still being restored.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=/agents/${agentId}`);
    }
  }, [authLoading, isAuthenticated, agentId, router]);

  useEffect(() => {
    // Don't fetch profile data until we know the visitor is allowed to see it.
    if (authLoading || !isAuthenticated) return;

    async function load() {
      try {
        // ✅ FIX: getUserById() routes through service layer — no direct db access
        const [agentData, agentListings, agentReviews] = await Promise.all([
          getUserById(agentId),
          getMyListings(agentId),
          getAgentReviews(agentId),
        ]);

        if (!agentData) {
          toast.error("Agent not found");
          router.push("/listings");
          return;
        }

        setAgent(agentData);
        setListings(agentListings.filter((l) => l.status === "active"));
        setReviews(agentReviews);
        // ✅ FIX: load feature flag
        getPlatformConfig().then((cfg) => {
          setReviewsEnabled(cfg.features.enableReviewsAndRatings !== false);
        }).catch(() => {});

        if (isAuthenticated && user) {
          const reviewed = await hasReviewed(user.id, agentId);
          setAlreadyReviewed(reviewed);
        }
      } catch {
        toast.error("Failed to load agent profile");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [agentId, isAuthenticated, authLoading, user, router]);

  const handleSubmitReview = async () => {
    if (!isAuthenticated || !user) { router.push("/login"); return; }
    if (reviewRating === 0) { toast.error("Select a star rating"); return; }
    if (!reviewComment.trim()) { toast.error("Write a brief comment"); return; }

    setIsSubmittingReview(true);
    try {
      const review = await createReview({
        agentId,
        reviewerId: user.id,
        reviewerName: user.name,
        reviewerAvatar: user.avatarUrl,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviews((prev) => [review, ...prev]);
      setAlreadyReviewed(true);
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment("");
      toast.success("Review submitted!");
    } catch {
      toast.error("Failed to submit review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSendMessage = async () => {
    if (!isAuthenticated || !user || !agent) { router.push("/login"); return; }
    if (!messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      const conv = await startConversation([
        { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
        { id: agent.id, name: agent.name, avatarUrl: agent.avatarUrl },
      ]);  // No listing context — agent profile message has no listing price
      await sendMessage(conv.id, user.id, agent.id, messageText.trim());
      toast.success("Message sent!");
      router.push("/messages");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!agent) return null;

  const roleCfg = ROLE_CONFIG[agent.role] ?? ROLE_CONFIG.agent;
  const avgRating = (agent as any).avgRating as number | undefined;
  const reviewCount = (agent as any).reviewCount as number | undefined;
  const initials = agent.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <Link href="/listings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to listings
        </Link>

        {/* Agent hero */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Avatar className="w-20 h-20 border-4 border-border shrink-0">
              <AvatarImage src={agent.avatarUrl} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-serif font-bold text-foreground">{agent.name}</h1>
                {agent.isVerified && (
                  <div className="badge-verified">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", roleCfg.bgColor, roleCfg.color)}>
                  {roleCfg.label}
                </span>
                {avgRating && (
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={Math.round(avgRating)} readonly />
                    <span className="text-sm font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">({reviewCount ?? 0} review{(reviewCount ?? 0) !== 1 ? "s" : ""})</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground mt-2">
                {listings.length} active listing{listings.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Button className="gap-2" onClick={() => setShowMessage(!showMessage)}>
                <MessageSquare className="w-4 h-4" />
                Message Agent
              </Button>
              {/* ✅ FIX: Only when enableReviewsAndRatings = true */}
              {reviewsEnabled && !alreadyReviewed && isAuthenticated && user?.id !== agentId && (
                <Button variant="outline" className="gap-2" onClick={() => setShowReviewForm(!showReviewForm)}>
                  <Star className="w-4 h-4" />
                  Leave Review
                </Button>
              )}
            </div>
          </div>

          {showMessage && (
            <div className="mt-5 pt-5 border-t border-border space-y-3">
              <p className="text-sm font-medium text-foreground">Send {agent.name.split(" ")[0]} a message</p>
              <Textarea
                placeholder="Ask about a listing, availability, or rates…"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <Button size="sm" className="gap-2" disabled={isSendingMessage || !messageText.trim()} onClick={handleSendMessage}>
                {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Send Message
              </Button>
            </div>
          )}

          {reviewsEnabled && showReviewForm && (
            <div className="mt-5 pt-5 border-t border-border space-y-3">
              <p className="text-sm font-medium text-foreground">Review {agent.name.split(" ")[0]}</p>
              <div className="flex items-center gap-2">
                <StarRating rating={reviewRating} onChange={setReviewRating} />
                {reviewRating > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {["", "Poor", "Fair", "Good", "Very good", "Excellent"][reviewRating]}
                  </span>
                )}
              </div>
              <Textarea
                placeholder="Describe your experience with this agent…"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <Button
                size="sm"
                disabled={isSubmittingReview || reviewRating === 0 || !reviewComment.trim()}
                onClick={handleSubmitReview}
                className="gap-2"
              >
                {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                Submit Review
              </Button>
            </div>
          )}
        </div>

        {/* Listings */}
        <div className="mb-8">
          <h2 className="text-xl font-serif font-bold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Active Listings ({listings.length})
          </h2>
          {listings.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No active listings yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </div>

        {/* Reviews — ✅ FIX: gated by enableReviewsAndRatings */}
        {reviewsEnabled && <div>
          <h2 className="text-xl font-serif font-bold text-foreground mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent" />
            Reviews ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border text-muted-foreground">
              <Star className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No reviews yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                          {review.reviewerName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{review.reviewerName}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(review.createdAt)}</p>
                      </div>
                    </div>
                    <StarRating rating={review.rating} readonly />
                  </div>
                  {review.listingTitle && (
                    <p className="text-xs text-primary mb-2">Re: {review.listingTitle}</p>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>}
      </div>
      <Footer />
    </div>
  );
}
