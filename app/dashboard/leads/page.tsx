"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Crown, Loader2, MapPin, MessageSquare,
  Phone, RefreshCw, Users2, X, Filter,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// ✅ Service abstraction — no direct Firestore
import { getLeadsForAgent, getMyClaimedLeads, claimLead, updateLeadStatus } from "@/services/leads";
import { getUserPlanStatus } from "@/services/subscriptions";
import { startConversation, sendMessage } from "@/services/messages";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Lead, LeadStatus } from "@/services/leads";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new:       { label: "New",       color: "bg-blue-100 text-blue-700" },
  contacted: { label: "Contacted", color: "bg-yellow-100 text-yellow-700" },
  qualified: { label: "Qualified", color: "bg-purple-100 text-purple-700" },
  converted: { label: "Converted", color: "bg-green-100 text-green-700" },
  closed:    { label: "Closed",    color: "bg-gray-100 text-gray-500" },
};

export default function LeadsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [canAccess, setCanAccess]       = useState<boolean | null>(null);
  const [planName, setPlanName]         = useState("Free");
  const [availableLeads, setAvailable]  = useState<Lead[]>([]);
  const [myLeads, setMyLeads]           = useState<Lead[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [activeTab, setActiveTab]       = useState<"available" | "mine">("available");
  const [search, setSearch]             = useState("");
  const [claiming, setClaiming]         = useState<string | null>(null);
  const [contacting, setContacting]     = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const slug = user.subscriptionPlan ?? "free";

    getUserPlanStatus(user.id, slug, user.subscriptionExpiry)
      .then(async (status) => {
        setPlanName(status.plan.name);
        if (!status.canAccessLeads) {
          setCanAccess(false);
          setIsLoading(false);
          return;
        }
        setCanAccess(true);
        // Load leads
        const [available, mine] = await Promise.all([
          getLeadsForAgent(user.id, slug, user.subscriptionExpiry).catch(() => []),
          getMyClaimedLeads(user.id).catch(() => []),
        ]);
        setAvailable(available);
        setMyLeads(mine);
        setIsLoading(false);
      })
      .catch(() => { setCanAccess(false); setIsLoading(false); });
  }, [user]);

  // ── Plan gate ─────────────────────────────────────────────────────────────
  if (canAccess === false) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
            Tenant Leads — Pro & Premium Only
          </h1>
          <p className="text-muted-foreground mb-2">
            Your current plan is <strong>{planName}</strong>. Upgrade to Pro or Premium to access
            active tenant and buyer leads looking for properties in your area.
          </p>
          <div className="bg-secondary/50 rounded-2xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm font-semibold text-foreground">What you get with Pro/Premium leads:</p>
            {[
              "See tenants actively looking for properties in your LGA",
              "Buyer budget, bedroom requirements, and move-in dates",
              "Direct contact details (phone + email)",
              "Claim leads before other agents",
              "Track contacted, qualified, and converted leads",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
          <Button onClick={() => router.push("/dashboard/subscription")} className="gap-2">
            <Crown className="w-4 h-4" /> Upgrade to Pro
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleClaim = async (lead: Lead) => {
    if (!user) return;
    setClaiming(lead.id);
    try {
      await claimLead(lead.id, user.id);
      setAvailable((prev) => prev.filter((l) => l.id !== lead.id));
      setMyLeads((prev) => [{ ...lead, status: "contacted", assignedAgentId: user.id }, ...prev]);
      toast.success("Lead claimed — contact details now visible");
    } catch { toast.error("Failed to claim lead"); }
    finally { setClaiming(null); }
  };

  const handleContact = async (lead: Lead) => {
    if (!user || !lead.userId) return;
    setContacting(lead.id);
    try {
      const conv = await startConversation([
        { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
        { id: lead.userId, name: lead.name },
      ]);
      await sendMessage(conv.id, user.id, lead.userId ?? lead.name,
        `Hi ${lead.name.split(" ")[0]}, I saw you're looking for a ${lead.type} in ${lead.lga ?? lead.state}. I have some great options that might suit you. Would you like to discuss?`
      );
      toast.success("Message sent!");
      router.push(`/messages?conv=${conv.id}`);
    } catch { toast.error("Failed to send message"); }
    finally { setContacting(null); }
  };

  const handleStatusUpdate = async (leadId: string, status: LeadStatus) => {
    try {
      await updateLeadStatus(leadId, status);
      setMyLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status } : l));
      toast.success("Status updated");
    } catch { toast.error("Failed to update status"); }
  };

  const displayLeads = (activeTab === "available" ? availableLeads : myLeads)
    .filter((l) =>
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.state.toLowerCase().includes(search.toLowerCase()) ||
      (l.lga?.toLowerCase().includes(search.toLowerCase())) ||
      (l.message?.toLowerCase().includes(search.toLowerCase()))
    );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Users2 className="w-6 h-6 text-primary" /> Tenant Leads
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Active buyers and tenants looking for properties
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={async () => {
          if (!user) return;
          setIsLoading(true);
          const slug = user.subscriptionPlan ?? "free";
          const [a, m] = await Promise.all([
            getLeadsForAgent(user.id, slug, user.subscriptionExpiry).catch(() => []),
            getMyClaimedLeads(user.id).catch(() => []),
          ]);
          setAvailable(a);
          setMyLeads(m);
          setIsLoading(false);
        }} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit mb-5">
        {(["available", "mine"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize",
              activeTab === tab
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {tab === "available" ? "Available Leads" : "My Leads"}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({tab === "available" ? availableLeads.length : myLeads.length})
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 mb-5">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <input type="text" placeholder="Filter by name, state, LGA…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {search && <button onClick={() => setSearch("")}><X className="w-4 h-4 text-muted-foreground" /></button>}
      </div>

      {/* Leads list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : displayLeads.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Users2 className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-foreground">
            {activeTab === "available" ? "No new leads right now" : "No leads claimed yet"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab === "available"
              ? "Check back soon — new leads come in daily"
              : "Claim leads from the Available tab to start here"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayLeads.map((lead) => {
            const statusCfg = STATUS_CONFIG[lead.status];
            const isClaimed = !!lead.assignedAgentId;

            return (
              <div key={lead.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    {/* Name + status */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-foreground">
                        {isClaimed ? lead.name : `${lead.name.split(" ")[0]} ${lead.name.split(" ").slice(1).map(n => n[0] + "•••").join(" ")}`}
                      </p>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", statusCfg.color)}>
                        {statusCfg.label}
                      </span>
                      <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                        {lead.type}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{lead.lga ? `${lead.lga}, ` : ""}{lead.state}</span>
                      {lead.bedrooms && <span className="ml-2">{lead.bedrooms} bed{lead.bedrooms > 1 ? "s" : ""}</span>}
                      {(lead.minBudget || lead.maxBudget) && (
                        <span className="ml-2">
                          {lead.minBudget && `₦${(lead.minBudget / 1000).toFixed(0)}k`}
                          {lead.minBudget && lead.maxBudget && " – "}
                          {lead.maxBudget && `₦${(lead.maxBudget / 1000).toFixed(0)}k`}
                        </span>
                      )}
                    </div>

                    {lead.message && (
                      <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg px-3 py-1.5 line-clamp-2">
                        "{lead.message}"
                      </p>
                    )}

                    {/* Contact details — only shown after claiming */}
                    {isClaimed && (lead.phone || lead.email) && (
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </a>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">{timeAgo(lead.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {activeTab === "available" && !isClaimed && (
                      <Button size="sm" className="gap-1.5 text-xs"
                        disabled={claiming === lead.id}
                        onClick={() => handleClaim(lead)}>
                        {claiming === lead.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Claim Lead
                      </Button>
                    )}

                    {activeTab === "mine" && lead.userId && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                        disabled={contacting === lead.id}
                        onClick={() => handleContact(lead)}>
                        {contacting === lead.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <MessageSquare className="w-3.5 h-3.5" />}
                        Message
                      </Button>
                    )}

                    {activeTab === "mine" && (
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusUpdate(lead.id, e.target.value as LeadStatus)}
                        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
