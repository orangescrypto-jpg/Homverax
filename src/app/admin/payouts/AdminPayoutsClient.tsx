"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, Wallet, RefreshCw, Search, Copy, Zap, Upload, Building2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAllPayoutRequests, approvePayout, rejectPayout, type PayoutRequest } from "@/services/wallet";
import { uploadPayoutProof } from "@/services/storage";
import { getPlatformConfig } from "@/services/platformSettings";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({});
  const [payoutMethod, setPayoutMethod] = useState<"manual" | "paystack">("manual");

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAllPayoutRequests();
      setPayouts(data);
    } catch { toast.error("Failed to load payouts"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    load();
    getPlatformConfig().then((cfg) => setPayoutMethod(cfg.payoutMethod ?? "manual"));
  }, []);

  // Manual mode: admin must supply a transfer reference AND a proof
  // screenshot before a payout can be approved — this is the evidence
  // needed if a seller later disputes "I never got paid."
  const handleApproveManual = async (p: PayoutRequest) => {
    const ref = refs[p.id]?.trim();
    const proof = proofFiles[p.id];
    if (!ref) { toast.error("Enter your bank transfer reference"); return; }
    if (!proof) { toast.error("Attach proof of payment (screenshot/receipt) before approving"); return; }

    setProcessing(p.id);
    try {
      const proofUrl = await uploadPayoutProof(p.id, proof);
      await approvePayout(p.id, ref, notes[p.id] ?? undefined, proofUrl, "manual");
      setPayouts((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "approved", reference: ref, proofUrl, payoutMethod: "manual" } : x));
      toast.success(`Payout approved for ${p.userName}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to approve");
    } finally { setProcessing(null); }
  };

  // Paystack mode: approving triggers an immediate real bank transfer via
  // Paystack's Transfers API — no manual reference/proof needed since
  // Paystack itself confirms the transfer.
  const handleApprovePaystack = async (p: PayoutRequest) => {
    if (!p.bankCode) {
      toast.error("This request has no bank code on file — seller must resubmit via the updated withdrawal form.");
      return;
    }
    setProcessing(p.id);
    try {
      const res = await fetch("/api/payments/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "paystack",
          amount: p.amount,
          accountName: p.accountName,
          accountNumber: p.accountNumber,
          bankCode: p.bankCode,
          reference: `PYT-${p.id}`,
          reason: `HomveraX payout for ${p.userName}`,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        // Common causes: insufficient Paystack balance, bad bank code, or
        // business KYC not yet approved for live transfers.
        toast.error(data.error || "Transfer failed — check Paystack balance and KYC status.");
        return;
      }
      await approvePayout(p.id, data.transferCode, notes[p.id] ?? undefined, undefined, "paystack");
      setPayouts((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "approved", reference: data.transferCode, payoutMethod: "paystack" } : x));
      toast.success(`Transfer sent to ${p.userName} via Paystack ⚡`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to approve");
    } finally { setProcessing(null); }
  };

  const handleReject = async (p: PayoutRequest) => {
    setProcessing(p.id);
    try {
      await rejectPayout(p.id, p.userId, p.amount, notes[p.id]);
      setPayouts((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "rejected" } : x));
      toast.success("Payout rejected — balance refunded to seller");
    } catch { toast.error("Failed to reject"); }
    finally { setProcessing(null); }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const filtered = payouts.filter((p) => {
    const matchFilter = filter === "all" || p.status === filter;
    const matchSearch = !search ||
      p.userName.toLowerCase().includes(search.toLowerCase()) ||
      p.bankName.toLowerCase().includes(search.toLowerCase()) ||
      p.accountNumber.includes(search);
    return matchFilter && matchSearch;
  });

  const pendingCount = payouts.filter((p) => p.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> Seller Payouts
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Approve or reject seller withdrawal requests
            {pendingCount > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} pending</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Payout mode banner */}
      <div className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium mb-6",
        payoutMethod === "paystack" ? "bg-green-50 text-green-700 border border-green-200" : "bg-yellow-50 text-yellow-700 border border-yellow-200"
      )}>
        {payoutMethod === "paystack" ? <Zap className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
        Payout mode: {payoutMethod === "paystack" ? "Paystack (automatic transfer on approval)" : "Manual (admin sends transfer by hand)"}
        <span className="text-xs opacity-70">— change in Admin Settings → Payment Methods</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, bank, account…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors",
                filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No {filter !== "all" ? filter : ""} payout requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <p className="font-semibold text-foreground">{p.userName}</p>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full capitalize", STATUS_STYLE[p.status])}>
                      {p.status === "pending" && <Clock className="w-3 h-3 inline mr-1" />}
                      {p.status === "approved" && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                      {p.status === "rejected" && <XCircle className="w-3 h-3 inline mr-1" />}
                      {p.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</span>
                  </div>

                  {/* Bank details */}
                  <div className="bg-secondary/50 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bank Details</p>
                    {[
                      { label: "Amount", value: formatCurrency(p.amount) },
                      { label: "Bank", value: p.bankName },
                      { label: "Account", value: p.accountNumber },
                      { label: "Name", value: p.accountName },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-foreground font-mono">{value}</span>
                          <button onClick={() => copy(value, label)}>
                            <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!p.bankCode && payoutMethod === "paystack" && p.status === "pending" && (
                      <p className="text-xs text-red-600 pt-1">⚠ No bank code on file — this request predates the Paystack-ready withdrawal form. Automatic transfer will fail.</p>
                    )}
                  </div>

                  {p.reference && (
                    <p className="text-xs text-green-700 mt-2 bg-green-50 px-3 py-1.5 rounded-lg">
                      Reference: {p.reference} {p.payoutMethod && `(${p.payoutMethod})`}
                    </p>
                  )}
                  {p.proofUrl && (
                    <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                      View proof of payment
                    </a>
                  )}
                  {p.note && (
                    <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 px-3 py-1.5 rounded-lg">Note: {p.note}</p>
                  )}
                </div>

                {/* Actions */}
                {p.status === "pending" && (
                  <div className="flex flex-col gap-2 w-full sm:w-80 shrink-0">
                    {payoutMethod === "manual" && (
                      <>
                        <Input
                          placeholder="Your bank transfer reference (required)"
                          value={refs[p.id] ?? ""}
                          onChange={(e) => setRefs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                        <label className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2.5 text-xs cursor-pointer hover:bg-secondary/40">
                          <Upload className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{proofFiles[p.id]?.name ?? "Attach proof of payment (required)"}</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => setProofFiles((prev) => ({ ...prev, [p.id]: e.target.files?.[0] ?? null }))}
                          />
                        </label>
                      </>
                    )}
                    <Textarea
                      placeholder="Note (optional)…"
                      className="text-xs h-16 resize-none"
                      value={notes[p.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      {payoutMethod === "paystack" ? (
                        <Button size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprovePaystack(p)} disabled={processing === p.id}>
                          <Zap className="w-4 h-4" />
                          {processing === p.id ? "Sending…" : "Approve & Send"}
                        </Button>
                      ) : (
                        <Button size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApproveManual(p)} disabled={processing === p.id}>
                          <CheckCircle2 className="w-4 h-4" />
                          {processing === p.id ? "…" : "Approve"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="flex-1 gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleReject(p)} disabled={processing === p.id}>
                        <XCircle className="w-4 h-4" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
