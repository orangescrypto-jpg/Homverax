"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare, Send, Shield, ChevronLeft,
  CheckCheck, Tag, CheckCircle2, X, RefreshCw,
  Loader2, ArrowRight, Home, ExternalLink,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { getPlatformConfig } from "@/services/platformSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  sendMessage, subscribeToMessages,
  subscribeToConversations, markConversationRead,
  sendOfferMessage, acceptOfferFromChat,
  rejectOfferFromChat, counterOfferFromChat,
  getMyConversations,
  getConversationMessages,
} from "@/services/messages";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Conversation, Message } from "@/types";

// ─── Offer card component ─────────────────────────────────────────────────────

function OfferCard({
  msg, isMe, isSeller, onAccept, onReject, onCounter, convId,
}: {
  msg: Message;
  isMe: boolean;
  isSeller: boolean;
  onAccept: (offerId: string, price: number) => void;
  onReject: (offerId: string, price: number) => void;
  onCounter: (offerId: string, price: number) => void;
  convId: string;
}) {
  const od = msg.offerData;
  if (!od) return null;

  const status: string = od.status ?? "pending";
  const isPending  = status === "pending";
  const isAccepted = status === "accepted";
  const isRejected = status === "rejected";
  const isCountered = status === "countered";
  const isPaid      = status === "paid";

  const statusStyle = {
    pending:   "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10",
    accepted:  "border-green-200 bg-green-50 dark:bg-green-900/10",
    rejected:  "border-red-200 bg-red-50 dark:bg-red-900/10",
    countered: "border-blue-200 bg-blue-50 dark:bg-blue-900/10",
    paid:      "border-green-300 bg-green-100 dark:bg-green-900/20",
  }[status] ?? "border-border bg-secondary";

  return (
    <div className={cn("rounded-2xl border p-4 min-w-[220px] max-w-[280px]", statusStyle)}>
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          {isMe ? "Your offer" : "Offer received"}
        </p>
      </div>

      <p className="text-xl font-serif font-bold text-foreground mb-1">
        {formatCurrency(od.proposedPrice)}
      </p>

      {od.originalPrice && od.proposedPrice !== od.originalPrice && (
        <p className="text-xs text-muted-foreground mb-1">
          Listed at {formatCurrency(od.originalPrice)}
        </p>
      )}

      {od.note && (
        <p className="text-xs text-muted-foreground italic mb-2">"{od.note}"</p>
      )}

      {/* Counter price */}
      {isCountered && od.counterPrice && (
        <div className="bg-blue-100 dark:bg-blue-900/20 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-blue-600 font-semibold">Counter-offer</p>
          <p className="text-base font-bold text-blue-700">{formatCurrency(od.counterPrice)}</p>
          {od.counterNote && <p className="text-xs text-blue-500 italic">"{od.counterNote}"</p>}
        </div>
      )}

      {/* Status badge */}
      <div className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-3",
        isAccepted && "bg-green-100 text-green-700",
        isRejected && "bg-red-100 text-red-700",
        isPending  && "bg-yellow-100 text-yellow-700",
        isCountered && "bg-blue-100 text-blue-700",
        isPaid     && "bg-green-200 text-green-800",
      )}>
        {isAccepted  && <><CheckCircle2 className="w-3 h-3" /> Accepted</>}
        {isRejected  && <><X className="w-3 h-3" /> Declined</>}
        {isPending   && <><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" /> Pending</>}
        {isCountered && <><RefreshCw className="w-3 h-3" /> Countered</>}
        {isPaid      && <><CheckCircle2 className="w-3 h-3" /> Paid to Escrow</>}
      </div>

      {/* Actions — seller sees Accept/Reject/Counter on pending offers */}
      {isSeller && isPending && (
        <div className="flex flex-col gap-1.5">
          <Button size="sm" className="w-full h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
            onClick={() => onAccept(od.offerId, od.proposedPrice)}>
            <CheckCircle2 className="w-3 h-3" /> Accept
          </Button>
          <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1"
            onClick={() => onCounter(od.offerId, od.proposedPrice)}>
            <RefreshCw className="w-3 h-3" /> Counter
          </Button>
          <Button size="sm" variant="outline"
            className="w-full h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => onReject(od.offerId, od.proposedPrice)}>
            <X className="w-3 h-3" /> Decline
          </Button>
        </div>
      )}

      {/* Buyer: accepted offer — go to checkout */}
      {!isSeller && isAccepted && (
        <Button size="sm" className="w-full h-7 text-xs gap-1" asChild>
          <a href={`/listings/${od.listingId ?? ""}?acceptedOffer=${od.offerId}`}>
            <Shield className="w-3 h-3" /> Pay to Escrow
            <ArrowRight className="w-3 h-3" />
          </a>
        </Button>
      )}

      {/* Buyer: countered offer — accept the counter */}
      {!isSeller && isCountered && od.counterPrice && (
        <Button size="sm" className="w-full h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
          onClick={() => onAccept(od.offerId, od.counterPrice ?? 0)}>
          <CheckCircle2 className="w-3 h-3" /> Accept Counter
        </Button>
      )}
    </div>
  );
}

// ─── Send offer modal ─────────────────────────────────────────────────────────

function SendOfferModal({
  listingPrice, onSend, onClose,
}: {
  listingPrice: number;
  onSend: (price: number, note: string) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(listingPrice);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!price || price <= 0) { toast.error("Enter a valid price"); return; }
    setSending(true);
    await onSend(price, note);
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Make an Offer</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Your Offer Price (₦)</label>
            <Input
              type="number"
              className="mt-1"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder={formatCurrency(listingPrice)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Listed at {formatCurrency(listingPrice)}
              {price < listingPrice && price > 0 && (
                <span className="ml-2 text-yellow-600 font-medium">
                  {Math.round(((listingPrice - price) / listingPrice) * 100)}% below asking
                </span>
              )}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Note (optional)</label>
            <Input className="mt-1" placeholder="e.g. Can move in immediately"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 gap-2" onClick={handleSend} disabled={sending || price <= 0}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
            Send Offer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Counter offer modal ──────────────────────────────────────────────────────

function CounterModal({
  offerId, originalPrice, onSubmit, onClose,
}: {
  offerId: string;
  originalPrice: number;
  onSubmit: (offerId: string, counterPrice: number, note: string) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(originalPrice);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Counter Offer</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Your Counter Price (₦)</label>
            <Input type="number" className="mt-1" value={price}
              onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Note (optional)</label>
            <Input className="mt-1" placeholder="e.g. Best I can do"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 gap-2" disabled={sending || price <= 0}
            onClick={async () => { setSending(true); await onSubmit(offerId, price, note); setSending(false); }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Send Counter
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Listing card shown at top of conversation ────────────────────────────────

function ConversationListingCard({ conv }: { conv: { listingId?: string; listingTitle?: string; listingPrice?: number } }) {
  if (!conv.listingId || !conv.listingTitle) return null;
  return (
    <Link
      href={`/listings/${conv.listingId}`}
      className="flex items-center gap-3 mx-4 mt-3 mb-1 p-3 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/70 transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Home className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Listing</p>
        <p className="text-sm font-semibold text-foreground truncate">{conv.listingTitle}</p>
        {conv.listingPrice != null && conv.listingPrice > 0 && (
          <p className="text-xs text-primary font-medium">
            ₦{conv.listingPrice.toLocaleString("en-NG")}
          </p>
        )}
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
    </Link>
  );
}

// ─── Main messages page ───────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [convsLoading, setConvsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ FIX: Offer system gated by enableOfferSystem flag
  const [offerSystemEnabled, setOfferSystemEnabled] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [counterModal, setCounterModal] = useState<{ offerId: string; price: number } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    // ✅ Load enableOfferSystem flag
    getPlatformConfig().then((cfg) => {
      setOfferSystemEnabled(cfg.features.enableOfferSystem !== false);
    }).catch(() => setOfferSystemEnabled(false));

    // ✅ FIX: subscribeToConversations() only ever fires on a Supabase
    // Realtime event — it never did an initial fetch, so the sidebar sat
    // on loading skeletons forever unless a new message happened to
    // arrive while the page was already open. Fetch once immediately on
    // mount, then let the realtime subscription handle live updates.
    let cancelled = false;
    getMyConversations(user.id)
      .then((convs) => {
        if (cancelled) return;
        setConversations(convs);
        setConvsLoading(false);

        const urlConvId = searchParams.get("conv");
        if (urlConvId && convs.find((c) => c.id === urlConvId)) {
          setActiveConvId(urlConvId);
        } else if (convs.length > 0) {
          setActiveConvId((prev) => prev ?? convs[0].id);
        }
      })
      .catch(() => { if (!cancelled) setConvsLoading(false); });

    const unsub = subscribeToConversations(user.id, (convs) => {
      setConversations(convs);
      setConvsLoading(false);

      // Auto-select from URL param or first conversation
      const urlConvId = searchParams.get("conv");
      if (urlConvId && convs.find(c => c.id === urlConvId)) {
        setActiveConvId(urlConvId);
      } else if (convs.length > 0 && !activeConvId) {
        setActiveConvId(convs[0].id);
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!activeConvId) return;
    // ✅ FIX: subscribeToMessages() only fires on a new Realtime event —
    // it never loaded the conversation's existing history, so opening a
    // thread always started empty ("No messages yet") even when prior
    // messages existed. Fetch the history once when the thread is opened,
    // then let the realtime subscription append any new messages.
    let cancelled = false;
    setMessages([]);
    getConversationMessages(activeConvId).then((msgs) => {
      if (!cancelled) setMessages(msgs);
    }).catch(() => {});

    const unsub = subscribeToMessages(activeConvId, (msg: Message) =>
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    );
    return () => { cancelled = true; unsub(); };
  }, [activeConvId]);

  useEffect(() => {
    if (!activeConvId || !user) return;
    markConversationRead(activeConvId, user.id).catch(() => {});
  }, [activeConvId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h1 className="text-2xl font-serif font-bold mb-4">Sign in to view messages</h1>
          <Button onClick={() => router.push("/login")}>Sign In</Button>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConvId || !user || isSending) return;
    setIsSending(true);
    try {
      const otherPId = conversations.find(c => c.id === activeConvId)?.participants.find(p => p.id !== user?.id)?.id ?? "";
      await sendMessage(activeConvId, user.id, otherPId, newMessage.trim());
      setNewMessage("");
    } catch { toast.error("Failed to send message"); }
    finally { setIsSending(false); }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const otherParticipant = activeConv?.participants.find((p) => p.id !== user?.id);
  const isSeller = activeConv?.participants.find(p => p.id === user?.id) !== undefined &&
    otherParticipant !== undefined;

  // ✅ FIX: listingPrice and sellerId now stored on conversation doc
  const listingPrice = activeConv?.listingPrice ?? 0;
  const listingId    = activeConv?.listingId    ?? "";
  const convSellerId = activeConv?.sellerId     ?? null;

  const getUnreadCount = (conv: Conversation) => {
    if (conv.unreadFor === user?.id) return conv.unreadCount;
    return 0;
  };

  // ── Offer action handlers ───────────────────────────────────────────────────

  const handleSendOffer = async (price: number, note: string) => {
    if (!user || !activeConvId || !activeConv) return;
    const other = activeConv.participants.find(p => p.id !== user.id);
    if (!other) return;

    // ✅ FIX: Buyer is always the one sending the offer (not the seller)
    // Use convSellerId to reliably identify seller vs buyer roles
    const sellerId   = convSellerId ?? other.id;
    const sellerName = activeConv.participants.find(p => p.id === sellerId)?.name ?? other.name;
    const buyerId    = user.id === sellerId ? other.id : user.id;
    const buyerName  = activeConv.participants.find(p => p.id === buyerId)?.name ?? user.name;

    try {
      await sendOfferMessage({
        conversationId: activeConvId,
        senderId:       user.id,
        receiverId:     other.id,
        listingId:      activeConv.listingId ?? "",
        listingTitle:   activeConv.listingTitle ?? "",
        buyerId,
        buyerName,
        sellerId,
        sellerName,
        proposedPrice:  price,
        originalPrice:  listingPrice,
        note,
      });
      setShowOfferModal(false);
      toast.success("Offer sent!");
    } catch { toast.error("Failed to send offer"); }
  };

  const handleAcceptOffer = async (offerId: string, price: number) => {
    if (!user || !activeConvId) return;
    try {
      await acceptOfferFromChat(offerId);
      toast.success("Offer accepted! Buyer can now proceed to escrow.");
    } catch { toast.error("Failed to accept offer"); }
  };

  const handleRejectOffer = async (offerId: string, price: number) => {
    if (!user || !activeConvId) return;
    try {
      await rejectOfferFromChat(offerId);
      toast.success("Offer declined");
    } catch { toast.error("Failed to decline offer"); }
  };

  const handleCounterOffer = async (offerId: string, counterPrice: number, note: string) => {
    if (!user || !activeConvId || !otherParticipant) return;
    try {
      const buyerMsg = messages.find(m => m.offerData?.offerId === offerId);
      const originalPrice = buyerMsg?.offerData?.proposedPrice ?? 0;
      await counterOfferFromChat(offerId, counterPrice, note);
      setCounterModal(null);
      toast.success("Counter-offer sent!");
    } catch { toast.error("Failed to send counter-offer"); }
  };

  // ✅ FIX: Reliable seller check — convSellerId is now stored on conversation doc
  // when buyer starts chat from listing page (startConversation gets agentId)
  const currentUserIsSeller = convSellerId ? user?.id === convSellerId : false;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Offer modal */}
      {showOfferModal && (
        <SendOfferModal
          listingPrice={listingPrice}
          onSend={handleSendOffer}
          onClose={() => setShowOfferModal(false)}
        />
      )}

      {/* Counter modal */}
      {counterModal && (
        <CounterModal
          offerId={counterModal.offerId}
          originalPrice={counterModal.price}
          onSubmit={handleCounterOffer}
          onClose={() => setCounterModal(null)}
        />
      )}

      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

        {/* Sidebar */}
        <div className={cn(
          "w-full md:w-80 border-r border-border shrink-0 flex flex-col bg-card",
          activeConvId ? "hidden md:flex" : "flex"
        )}>
          <div className="p-4 border-b border-border">
            <h2 className="font-serif font-semibold text-foreground text-lg">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convsLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-3/4 rounded" />
                      <div className="skeleton h-3 w-full rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No conversations yet.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const other = conv.participants.find((p) => p.id !== user?.id);
                const isActive = conv.id === activeConvId;
                const unread = getUnreadCount(conv);
                return (
                  <button key={conv.id} onClick={() => setActiveConvId(conv.id)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors border-b border-border/50",
                      isActive && "bg-primary/5 border-l-2 border-l-primary"
                    )}>
                    <div className="relative shrink-0">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={other?.avatarUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                          {other?.name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-sm truncate", unread > 0 ? "font-bold" : "font-semibold")}>
                          {other?.name ?? "Unknown"}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {timeAgo(conv.lastMessageAt)}
                        </span>
                      </div>
                      {conv.listingTitle && (
                        <p className="text-xs text-primary truncate">{conv.listingTitle}</p>
                      )}
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={cn("text-xs truncate flex-1", unread > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                          {conv.lastMessage || "No messages yet"}
                        </p>
                        {unread > 0 && (
                          <span className="ml-2 shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={cn("flex-1 flex flex-col min-w-0", !activeConvId && "hidden md:flex")}>
          {activeConvId && activeConv ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3 shrink-0">
                <button className="md:hidden p-1 text-muted-foreground" onClick={() => setActiveConvId(null)}>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <Avatar className="w-9 h-9">
                  <AvatarImage src={otherParticipant?.avatarUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                    {otherParticipant?.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{otherParticipant?.name}</p>
                  {activeConv.listingTitle && (
                    <p className="text-xs text-primary truncate">{activeConv.listingTitle}</p>
                  )}
                </div>
                {/* ✅ FIX: Make Offer gated by enableOfferSystem flag AND buyer-only */}
                {offerSystemEnabled && activeConv.listingId && user?.id !== convSellerId && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0"
                    onClick={() => setShowOfferModal(true)}>
                    <Tag className="w-3.5 h-3.5" /> Make Offer
                  </Button>
                )}
              </div>

              {/* Listing card — shown when conversation is about a specific listing */}
              <ConversationListingCard conv={activeConv} />

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                    <div>
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No messages yet. Say hello!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.senderId === user?.id;
                    const isLast = idx === messages.length - 1;
                    const msgType = msg.type;
                    const isOfferMsg = ["offer", "offer_accepted", "offer_rejected", "offer_countered"].includes(msgType ?? "");

                    // Seller for THIS conversation = whoever is not the buyer
                    // We check via offerData.sellerId if present
                    // ✅ FIX: Use sellerId from conversation doc (set when chat was started from listing)
                    // Fallback to offerData.sellerId for older conversations
                    const offerSellerId = msg.offerData?.sellerId ?? convSellerId;
                    const iAmSeller = offerSellerId ? user?.id === offerSellerId : false;

                    if (isOfferMsg) {
                      return (
                        <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                          {!isMe && (
                            <Avatar className="w-7 h-7 mr-2 shrink-0 mt-1">
                              <AvatarFallback className="text-xs">{otherParticipant?.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                          )}
                          <div>
                            <OfferCard
                              msg={msg}
                              isMe={isMe}
                              isSeller={iAmSeller}
                              onAccept={handleAcceptOffer}
                              onReject={handleRejectOffer}
                              onCounter={(offerId, price) => setCounterModal({ offerId, price })}
                              convId={activeConvId}
                            />
                            <p className={cn("text-[10px] mt-1 text-muted-foreground", isMe ? "text-right" : "text-left")}>
                              {timeAgo(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        {!isMe && (
                          <Avatar className="w-7 h-7 mr-2 shrink-0 mt-1">
                            <AvatarImage src={otherParticipant?.avatarUrl} />
                            <AvatarFallback className="text-xs">{otherParticipant?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn(
                          "max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm",
                          isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                        )}>
                          <p className="leading-relaxed">{msg.content}</p>
                          <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
                            <p className={cn("text-[10px]", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>
                              {timeAgo(msg.createdAt)}
                            </p>
                            {isMe && isLast && <CheckCheck className="w-3 h-3 text-primary-foreground/60" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border bg-card shrink-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={!newMessage.trim() || isSending} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
              <div>
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-foreground">Select a conversation</p>
                <p className="text-sm mt-1">Choose from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
