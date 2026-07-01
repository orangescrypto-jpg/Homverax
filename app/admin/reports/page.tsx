"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, Building2, CheckCircle2,
  Eye, Loader2, ShieldAlert, Trash2, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
// ✅ FIX: Use updateListing + deleteListing from service layer for mutations
import { updateListing, deleteListing } from "@/services/listings";
// ✅ FIX: Remaining read (getReportedListings) goes through listings service
import { getReportedListings } from "@/services/listings";
import { timeAgo, formatPriceLabel } from "@/lib/utils";
import { toast } from "sonner";
import type { PropertyListing } from "@/types";

interface ReportedListing extends PropertyListing {
  reportReason?: string;
  reportCount?: number;
  reportedAt?: string;
}

export default function AdminReportsPage() {
  const [reported, setReported] = useState<ReportedListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    // ✅ FIX: Uses getReportedListings() from listings service
    getReportedListings()
      .then((list) => setReported(list as ReportedListing[]))
      .catch(() => setReported([]))
      .finally(() => setIsLoading(false));
  }, []);

  const handleDismiss = async (id: string) => {
    setActing(id);
    try {
      // ✅ FIX: Uses updateListing() from listings service
      await updateListing(id, {
        reported: false,
        reportReason: null,
        reportCount: 0,
      } as any);
      setReported((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report dismissed — listing restored");
    } catch {
      toast.error("Failed to dismiss report");
    } finally {
      setActing(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this listing? The agent will be notified.")) return;
    setActing(id);
    try {
      // ✅ FIX: Uses updateListing() from listings service
      await updateListing(id, {
        status: "paused",
        reported: false,
        removedByModerator: true,
      } as any);
      setReported((prev) => prev.filter((r) => r.id !== id));
      toast.success("Listing removed from platform");
    } catch {
      toast.error("Failed to remove listing");
    } finally {
      setActing(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Reported Listings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {reported.length} listing{reported.length !== 1 ? "s" : ""} flagged for review
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : reported.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <ShieldAlert className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">No reports</h2>
          <p className="text-muted-foreground text-sm">No listings have been flagged.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reported.map((r) => (
            <div key={r.id} className="bg-card border-2 border-amber-200 dark:border-amber-800/30 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-600">
                      {r.reportCount} report{(r.reportCount ?? 0) > 1 ? "s" : ""}
                    </span>
                    {r.reportedAt && (
                      <span className="text-xs text-muted-foreground">{timeAgo(r.reportedAt)}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground">{r.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {r.location?.lga}, {r.location?.state} · {formatPriceLabel(r.price, r.priceUnit)}
                  </p>
                </div>
              </div>

              {/* Report reason */}
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl p-3 mb-4 text-sm">
                <span className="font-semibold text-amber-700 dark:text-amber-400">Reason: </span>
                <span className="text-amber-600 dark:text-amber-300">{r.reportReason}</span>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                  <a href={`/listings/${r.id}`} target="_blank" rel="noopener noreferrer">
                    <Eye className="w-3.5 h-3.5" /> View Listing
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs flex-1 text-green-600 border-green-200 hover:bg-green-50"
                  disabled={acting === r.id}
                  onClick={() => handleDismiss(r.id)}
                >
                  {acting === r.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Dismiss Report
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs flex-1"
                  variant="outline"
                  disabled={acting === r.id}
                  onClick={() => handleRemove(r.id)}
                  style={{ color: "rgb(239 68 68)", borderColor: "rgb(254 202 202)" }}
                >
                  {acting === r.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Remove Listing
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
