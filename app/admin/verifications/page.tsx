"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, Loader2, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPendingVerifications, reviewVerification } from "@/services/verification";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { VerificationRequest } from "@/types";

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  useEffect(() => {
    getPendingVerifications()
      .then(setVerifications)
      .finally(() => setIsLoading(false));
  }, []);

  const handleApprove = async (v: VerificationRequest) => {
    setActing(v.id);
    try {
      await reviewVerification(v.id, v.userId, "approved");
      setVerifications((prev) => prev.filter((x) => x.id !== v.id));
      toast.success(`${v.userName} verified successfully`);
    } catch { toast.error("Failed to approve"); }
    finally { setActing(null); }
  };

  const handleReject = async (v: VerificationRequest) => {
    const reason = rejectReason[v.id];
    if (!reason?.trim()) { toast.error("Enter a rejection reason"); return; }
    setActing(v.id);
    try {
      await reviewVerification(v.id, v.userId, "rejected", reason);
      setVerifications((prev) => prev.filter((x) => x.id !== v.id));
      toast.success("Verification rejected");
    } catch { toast.error("Failed to reject"); }
    finally { setActing(null); }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Pending Verifications</h1>
        <p className="text-muted-foreground text-sm mt-1">{verifications.length} awaiting review</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}</div>
      ) : verifications.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <BadgeCheck className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-serif font-bold text-foreground">All caught up!</h2>
          <p className="text-muted-foreground text-sm mt-2">No pending verifications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {verifications.map((v) => (
            <div key={v.id} className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-semibold text-foreground">{v.userName}</p>
                  <p className="text-sm text-muted-foreground">{v.userEmail}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="capitalize bg-secondary px-2 py-0.5 rounded">{v.type} verification</span>
                    <span>{timeAgo(v.submittedAt)}</span>
                    <span>Fee: {formatCurrency(v.amountPaid)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                {v.bvn && <div className="bg-secondary/50 rounded-lg p-3"><span className="text-muted-foreground">BVN: </span><span className="font-medium">{v.bvn.replace(/\d(?=\d{4})/g, "*")}</span></div>}
                {v.nin && <div className="bg-secondary/50 rounded-lg p-3"><span className="text-muted-foreground">NIN: </span><span className="font-medium">{v.nin.replace(/\d(?=\d{4})/g, "*")}</span></div>}
                {v.idDocumentUrl && (
                  <a href={v.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-primary text-xs hover:underline">
                    View ID Document →
                  </a>
                )}
                {v.selfieUrl && (
                  <a href={v.selfieUrl} target="_blank" rel="noopener noreferrer" className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-primary text-xs hover:underline">
                    View Selfie →
                  </a>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Input
                  placeholder="Rejection reason (required to reject)"
                  value={rejectReason[v.id] ?? ""}
                  onChange={(e) => setRejectReason((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  className="flex-1 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={acting === v.id}
                    onClick={() => handleReject(v)}
                  >
                    {acting === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Reject
                  </Button>
                  <Button
                    className="gap-1 bg-green-600 hover:bg-green-700"
                    disabled={acting === v.id}
                    onClick={() => handleApprove(v)}
                  >
                    {acting === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
