"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Search, ArrowLeft, RefreshCw, Loader2, Send } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface AdminConversation {
  id: string;
  participants: { id: string; name: string; avatarUrl?: string }[];
  listingId?: string;
  listingTitle?: string;
  listingPrice?: number;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
}

interface AdminMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  readAt?: string;
  createdAt: string;
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminConversation | null>(null);
  const [thread, setThread] = useState<AdminMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadConversations(q = "") {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to load conversations");
      }
      const { conversations: convs } = await res.json();
      setConversations(convs ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  async function fetchThread(conversationId: string) {
    const res = await fetch(`/api/admin/conversations/${conversationId}/messages`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load messages");
    const { messages } = await res.json();
    return (messages ?? []) as AdminMessage[];
  }

  async function openConversation(conv: AdminConversation) {
    setSelected(conv);
    setThreadLoading(true);
    try {
      const messages = await fetchThread(conv.id);
      setThread(messages);
    } catch {
      toast.error("Failed to load conversation");
    } finally {
      setThreadLoading(false);
    }
  }

  // ── Realtime: subscribe to new inserts on this conversation while open ──
  useEffect(() => {
    if (!selected) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-messages:${selected.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selected.id}` },
        async () => {
          // Re-fetch through our route so we get resolved sender names/content parsing.
          try {
            const messages = await fetchThread(selected.id);
            setThread(messages);
          } catch {
            // silent — next poll/refresh will catch up
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread]);

  async function handleSend() {
    if (!selected || !replyText.trim() || sending) return;
    const content = replyText.trim();
    setSending(true);
    try {
      const res = await fetch(`/api/admin/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to send message");
      }
      const { message } = await res.json();
      setThread((prev) => [...prev, message]);
      setReplyText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadConversations(query);
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""} across the platform
          </p>
        </div>
        <button
          onClick={() => loadConversations(query)}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors shrink-0"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {selected ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
            <button
              onClick={() => { setSelected(null); setThread([]); setReplyText(""); }}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">
                {selected.participants.map((p) => p.name).join(" ↔ ")}
              </p>
              {selected.listingTitle && (
                <p className="text-xs text-muted-foreground truncate">
                  {selected.listingTitle}
                  {typeof selected.listingPrice === "number" ? ` · ${formatCurrency(selected.listingPrice)}` : ""}
                </p>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="p-4 max-h-[55vh] overflow-y-auto space-y-3">
            {threadLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : thread.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No messages in this conversation.</p>
            ) : (
              thread.map((m) => (
                <div key={m.id} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground">{m.senderName}</span>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                    {m.type !== "text" && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {m.type.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2 text-sm text-foreground max-w-lg">
                    {m.content || <span className="italic text-muted-foreground">(no text)</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reply box */}
          <div className="p-3 border-t border-border flex items-end gap-2 shrink-0">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Reply as HomveraX Support..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={sending || !replyText.trim()}
              className="shrink-0 p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              title="Send"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={handleSearch} className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, listing, or message content..."
              className="pl-9"
            />
          </form>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-2xl border border-border">
              <MessageSquare className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">No conversations yet</h2>
              <p className="text-muted-foreground text-sm">Messages between users will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {conv.participants.map((p) => p.name).join(" ↔ ")}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                    </div>
                    {conv.listingTitle && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.listingTitle}</p>
                    )}
                    <p className="text-sm text-muted-foreground truncate mt-1">{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="shrink-0 text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
