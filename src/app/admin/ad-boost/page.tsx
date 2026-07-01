"use client";

import { useEffect, useState } from "react";
import {
  BarChart2, CheckCircle2, DollarSign, Loader2,
  RefreshCw, Rocket, ToggleLeft, ToggleRight, X, Play, Flag,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  adminGetAllAdBoosts,
  adminUpdateBoostStatus,
  adminToggleAdBoost,
  getAdBoostRevenueSummaryExtended as getAdBoostRevenueSummary,
  adminAddBoostReport,
} from "@/services/adBoostService";
import { getPlatformConfig } from "@/services/platformSettings";
import { formatCurrency, cn, timeAgo } from "@/lib/utils";
import type { AdBoost, AdBoostRevenueSummaryExtended as AdBoostRevenueSummary, AdBoostStatus } from "@/services/adBoostService";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  active:    "bg-blue-100 text-blue-700",
  running:   "bg-green-100 text-green-700",
  completed: "bg-secondary text-muted-foreground",
  cancelled: "bg-red-100 text-red-600",
};

const PLATFORM_COLORS: Record<string, string> = {
  google: "bg-blue-100 text-blue-700", instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-blue-100 text-blue-800", tiktok: "bg-slate-100 text-slate-700",
  twitter: "bg-slate-100 text-slate-600",
};

export default function AdminAdBoostPage() {
  const { user } = useAuth();
  const [boosts, setBoosts]         = useState<AdBoost[]>([]);
  const [summary, setSummary]       = useState<AdBoostRevenueSummary | null>(null);
  const [isEnabled, setIsEnabled]   = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [filter, setFilter]         = useState<AdBoostStatus | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  // Report modal state
  const [reportBoost, setReportBoost]           = useState<AdBoost | null>(null);
  const [reportImpressions, setReportImpressions] = useState("");
  const [reportClicks, setReportClicks]           = useState("");
  const [reportReach, setReportReach]             = useState("");
  const [reportNotes, setReportNotes]             = useState("");
  const [isSavingReport, setIsSavingReport]       = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [cfg, data, rev] = await Promise.all([
        getPlatformConfig(),
        adminGetAllAdBoosts(filter === "all" ? undefined : filter as AdBoostStatus),
        getAdBoostRevenueSummary(),
      ]);
      setIsEnabled(cfg.features.enableAdBoost ?? false);
      setBoosts(data);
      setSummary(rev);
    } catch { toast.error("Failed to load Ad Boost data"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleToggle = async () => {
    if (!user) return;
    setIsToggling(true);
    try {
      await adminToggleAdBoost(!isEnabled, user.id, user.name);
      setIsEnabled(!isEnabled);
      toast.success(`Ad Boost ${!isEnabled ? "enabled" : "disabled"} for all sellers`);
    } catch { toast.error("Failed to toggle Ad Boost"); }
    finally { setIsToggling(false); }
  };

  const handleStatus = async (boost: AdBoost, status: AdBoostStatus) => {
    setProcessing(boost.id);
    try {
      await adminUpdateBoostStatus(boost.id, status);
      setBoosts((prev) => prev.map((b) => b.id === boost.id ? { ...b, status } : b));
      toast.success(`Boost marked as ${status}`);
    } catch { toast.error("Failed to update status"); }
    finally { setProcessing(null); }
  };

  const handleSaveReport = async () => {
    if (!reportBoost) return;
    setIsSavingReport(true);
    try {
      await adminAddBoostReport(reportBoost.id, {
        weekNumber:   reportBoost.weekNumber ?? 0,
        impressions:  parseInt(reportImpressions) || 0,
        clicks:       parseInt(reportClicks)      || 0,
        reach:        parseInt(reportReach)       || 0,
        spend:        reportBoost.adSpendBudget,
        topPlatform:  reportBoost.platforms[0],
        notes:        reportNotes,
      });
      setBoosts((prev) => prev.map((b) => b.id === reportBoost.id
        ? { ...b, impressions: parseInt(reportImpressions) || 0, clicks: parseInt(reportClicks) || 0, reach: parseInt(reportReach) || 0 }
        : b));
      toast.success("Performance report saved");
      setReportBoost(null);
    } catch { toast.error("Failed to save report"); }
    finally { setIsSavingReport(false); }
  };

  const pendingCount = boosts.filter((b) => b.status === "pending").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" /> Ad Boost Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage external listing promotion campaigns
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Master toggle */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">Ad Boost Feature</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEnabled
                ? "Sellers can currently purchase and submit Ad Boost campaigns."
                : "Ad Boost is disabled. Sellers see a 'Coming Soon' screen."}
            </p>
          </div>
          <Button
            onClick={handleToggle}
            disabled={isToggling}
            variant={isEnabled ? "default" : "outline"}
            className={cn("gap-2 min-w-[140px]", isEnabled ? "bg-green-600 hover:bg-green-700 text-white" : "")}
          >
            {isToggling
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isEnabled
                ? <ToggleRight className="w-4 h-4" />
                : <ToggleLeft className="w-4 h-4" />
            }
            {isEnabled ? "ON — Disable" : "OFF — Enable"}
          </Button>
        </div>
      </div>

      {/* Revenue summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Collected",   value: formatCurrency(summary.totalCollected), icon: DollarSign, color: "text-green-500" },
            { label: "Ad Spend Allocated",value: formatCurrency(summary.totalAdSpend),   icon: BarChart2,  color: "text-blue-500"  },
            { label: "Platform Margin",   value: formatCurrency(summary.totalMargin),    icon: Rocket,     color: "text-primary"   },
            { label: "Running Now",       value: summary.runningCount.toString(),         icon: Play,       color: "text-amber-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4">
              <Icon className={cn("w-4 h-4 mb-2", color)} />
              <p className="text-xl font-serif font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["pending", "active", "running", "completed", "cancelled", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-xl text-sm font-medium capitalize transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}>
            {f}{f === "pending" && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      {/* Campaigns table */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /><span>Loading...</span>
        </div>
      ) : boosts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Rocket className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No {filter === "all" ? "" : filter} campaigns.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {boosts.map((boost) => (
            <div key={boost.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start gap-4">
                {boost.listingImage && (
                  <img src={boost.listingImage} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="font-semibold text-foreground">{boost.listingTitle}</p>
                      <p className="text-xs text-muted-foreground">{boost.agentName} · {boost.listingLocation}</p>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", STATUS_COLOR[boost.status])}>
                      {boost.status}
                    </span>
                  </div>

                  {/* Platforms */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {boost.platforms.map((p) => (
                      <span key={p} className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium", PLATFORM_COLORS[p])}>
                        {p}
                      </span>
                    ))}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: "Paid",        value: formatCurrency(boost.amountPaid)  },
                      { label: "Ad Spend",    value: formatCurrency(boost.adSpendBudget) },
                      { label: "Impressions", value: boost.impressions.toLocaleString()  },
                      { label: "Clicks",      value: boost.clicks.toLocaleString()       },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-secondary/50 rounded-xl p-2 text-center">
                        <p className="text-xs font-bold text-foreground">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">
                    Week {boost.weekNumber} · {boost.planName} · {timeAgo(boost.createdAt)}
                  </p>

                  {/* Admin actions */}
                  <div className="flex flex-wrap gap-2">
                    {boost.status === "pending" && (
                      <Button size="sm" onClick={() => handleStatus(boost, "active")}
                        disabled={processing === boost.id}
                        className="gap-1 bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs">
                        {processing === boost.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Approve
                      </Button>
                    )}
                    {boost.status === "active" && (
                      <Button size="sm" onClick={() => handleStatus(boost, "running")}
                        disabled={processing === boost.id}
                        className="gap-1 bg-green-600 hover:bg-green-700 text-white h-7 text-xs">
                        {processing === boost.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Mark Running
                      </Button>
                    )}
                    {boost.status === "running" && (
                      <>
                        <Button size="sm" onClick={() => { setReportBoost(boost); setReportImpressions(boost.impressions.toString()); setReportClicks(boost.clicks.toString()); setReportReach(boost.reach.toString()); }}
                          variant="outline" className="gap-1 h-7 text-xs">
                          <BarChart2 className="w-3 h-3" /> Update Stats
                        </Button>
                        <Button size="sm" onClick={() => handleStatus(boost, "completed")}
                          disabled={processing === boost.id}
                          className="gap-1 h-7 text-xs">
                          {processing === boost.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
                          Complete
                        </Button>
                      </>
                    )}
                    {(boost.status === "pending" || boost.status === "active") && (
                      <Button size="sm" variant="outline"
                        onClick={() => handleStatus(boost, "cancelled")}
                        disabled={processing === boost.id}
                        className="gap-1 h-7 text-xs text-destructive border-destructive/30">
                        <X className="w-3 h-3" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report modal */}
      {reportBoost && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Update Performance Stats</h2>
              <button onClick={() => setReportBoost(null)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{reportBoost.listingTitle}</p>
            <div className="space-y-3 mb-4">
              {[
                { label: "Impressions", value: reportImpressions, set: setReportImpressions },
                { label: "Clicks",      value: reportClicks,      set: setReportClicks      },
                { label: "Reach",       value: reportReach,       set: setReportReach       },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <Label>{label}</Label>
                  <Input className="mt-1" type="number" value={value} onChange={(e) => set(e.target.value)} />
                </div>
              ))}
              <div>
                <Label>Notes (optional)</Label>
                <Input className="mt-1" value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} placeholder="e.g. Instagram performing best" />
              </div>
            </div>
            <Button onClick={handleSaveReport} disabled={isSavingReport} className="w-full gap-2">
              {isSavingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
              Save Report
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
