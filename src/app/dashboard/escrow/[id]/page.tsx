"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  AlertCircle, AlertTriangle, BanknoteIcon,
  CheckCircle2, ChevronLeft, Clock, Copy,
  ExternalLink, Loader2, Shield, Upload, FileImage, Download,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getEscrowById, submitTransferProof,
  holdEscrow, startInspection,
  confirmDelivery, openDispute, cancelEscrow,
} from "@/services/escrow";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { ESCROW_STEPS, PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { getPlatformConfig, type BankDetails } from "@/services/platformSettings";
import { initializePayment } from "@/services/payment";
import { usePaymentMethod } from "@/components/payment/PaymentMethodPicker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { EscrowTransaction } from "@/types";
import { PAYMENT_REJECTION_REASON_LABELS } from "@/types";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  pending:                "text-yellow-600 bg-yellow-50 border-yellow-200",
  awaiting_confirmation:  "text-blue-600 bg-blue-50 border-blue-200",
  payment_rejected:       "text-red-600 bg-red-50 border-red-200",
  funded:                 "text-indigo-600 bg-indigo-50 border-indigo-200",
  held:                   "text-purple-600 bg-purple-50 border-purple-200",
  inspection:             "text-orange-600 bg-orange-50 border-orange-200",
  released:               "text-green-600 bg-green-50 border-green-200",
  disputed:               "text-red-600 bg-red-50 border-red-200",
  resolved:               "text-gray-600 bg-gray-50 border-gray-200",
  refunded:               "text-orange-600 bg-orange-50 border-orange-200",
};

// ─── Copy to clipboard helper ─────────────────────────────────────────────────
async function copyText(text: string, label: string) {
  await navigator.clipboard.writeText(text);
  toast.success(`${label} copied!`);
}

export default function EscrowDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [escrow, setEscrow] = useState<EscrowTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [bank, setBank] = useState<BankDetails>({
    bankName: "—", accountNumber: "—", accountName: "—", sortCode: "—",
  });
  const [platformFee, setPlatformFee] = useState(PLATFORM_FEE_PERCENT);

  // Transfer proof form
  const [transferRef, setTransferRef] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // Dispute form
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  // Admin may have Manual, Paystack, or both enabled — this drives which
  // pay flow(s) render below.
  const { slug: payMethod, providers: payProviders, Picker: PaymentPicker } = usePaymentMethod();
  const [isPayingOnline, setIsPayingOnline] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  useEffect(() => {
    Promise.all([
      getEscrowById(id),
      getPlatformConfig(),
    ])
      .then(([e, cfg]) => {
        setEscrow(e);
        setBank(cfg.bank);
        setPlatformFee(cfg.escrowFees?.buyerServiceChargePercent ?? PLATFORM_FEE_PERCENT);
      })
      .catch(() => toast.error("Failed to load escrow"))
      .finally(() => setIsLoading(false));
  }, [id]);

  const refresh = async () => {
    const updated = await getEscrowById(id);
    setEscrow(updated);
  };

  const act = async (fn: () => Promise<void>, successMsg: string) => {
    setIsActing(true);
    try {
      await fn();
      await refresh();
      toast.success(successMsg);
    } catch {
      toast.error("Action failed. Please try again.");
    } finally {
      setIsActing(false);
    }
  };

  const handleSubmitTransfer = async () => {
    if (!receiptFile) {
      toast.error("Attach a photo or screenshot of your payment receipt before continuing");
      return;
    }
    let receiptUrl: string | undefined;
    setIsUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append("file", receiptFile);
      formData.append("path", `escrow-receipts/${id}-${Date.now()}-${receiptFile.name}`);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      receiptUrl = data.url;
    } catch {
      toast.error("Failed to upload receipt. Please try attaching it again.");
      setIsUploadingReceipt(false);
      return;
    }
    setIsUploadingReceipt(false);
    await act(
      () => submitTransferProof(id, transferRef.trim(), receiptUrl),
      "Transfer submitted! We'll confirm within 1 business hour."
    );
    setTransferRef("");
    setReceiptFile(null);
  };

  const handleDownloadReceipt = async () => {
    if (!escrow) return;
    setIsDownloadingReceipt(true);
    try {
      const res = await fetch(`/api/escrow/${escrow.id}/receipt`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate receipt" }));
        throw new Error(err.error ?? "Failed to generate receipt");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HomveraX-Receipt-${escrow.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download receipt");
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const handlePayOnline = () => {
    if (!user || !escrow) return;
    setIsPayingOnline(true);
    initializePayment(
      {
        email: user.email,
        amount: totalPayable,
        reference: `ESCROW-${escrow.id}-${Date.now()}`,
        metadata: { escrowId: escrow.id, type: "escrow" },
        onSuccess: async (reference) => {
          try {
            const res = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference, escrowId: escrow.id }),
            });
            if (!res.ok) throw new Error();
            await refresh();
            toast.success("Payment confirmed! Funds are now held in escrow.");
          } catch {
            toast.error("Payment received but verification failed — contact support with your reference.");
          } finally {
            setIsPayingOnline(false);
          }
        },
        onClose: () => setIsPayingOnline(false),
      },
      payMethod ?? undefined,
    );
  };

  const handleCancelOrder = async () => {
    if (!window.confirm("Cancel this order? It will be deleted permanently — you can start a new order for this listing right after.")) return;
    setIsCancelling(true);
    try {
      await cancelEscrow(id);
      toast.success("Order cancelled");
      router.push("/dashboard/escrow");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDisputeSubmit = async () => {
    if (!disputeReason.trim()) { toast.error("Describe the issue"); return; }
    await act(
      () => openDispute(id, disputeReason),
      "Dispute opened. Our team will review within 24 hours."
    );
    setShowDispute(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!escrow) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <Shield className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-serif font-bold">Transaction not found</h2>
          <Button className="mt-4" onClick={() => router.push("/dashboard/escrow")}>
            Back to Escrow
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isBuyer  = escrow.buyerId  === user?.id;
  const isSeller = escrow.sellerId === user?.id;
  // ✅ FIX: was escrow.amount + escrow.platformFee — platformFee is the
  // SELLER's platform cut, deducted from what the seller receives, not
  // something the buyer pays on top. The buyer only ever pays
  // amount + buyerServiceCharge (their own, separate fee — e.g. shown as
  // "Escrow fee (0%)" in the Confirm Payment modal). Using platformFee
  // here meant the transfer instructions showed a nonzero amount even
  // when admin had set the buyer service charge to 0%.
  const totalPayable = escrow.amount + escrow.buyerServiceCharge;

  // Stepper — include awaiting_confirmation in the visual steps
  const DISPLAY_STEPS = ESCROW_STEPS.filter((s) =>
    !["disputed", "resolved", "refunded"].includes(s.key)
  );
  // "payment_rejected" isn't one of the forward-progress steps, but it
  // logically sits at "Transfer Submitted" — the buyer did submit, it just
  // wasn't accepted. Pinning it there (rather than -1/no-highlight) avoids
  // the stepper going blank, as it did before this fix.
  const currentStepIdx = escrow.status === "payment_rejected"
    ? DISPLAY_STEPS.findIndex((s) => s.key === "awaiting_confirmation")
    : DISPLAY_STEPS.findIndex((s) => s.key === escrow.status);

  return (
    <DashboardLayout>
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/escrow")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Escrow
      </button>

      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Header card ───────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-serif font-bold text-foreground">
                {escrow.listingTitle}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{escrow.listingLocation}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-serif font-bold text-primary">
                {formatCurrency(escrow.amount)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                + {formatCurrency(escrow.buyerServiceCharge)} ({platformFee}% fee)
              </p>
              <span className={cn(
                "inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-lg border capitalize",
                STATUS_COLOR[escrow.status] ?? "text-muted-foreground bg-secondary border-border"
              )}>
                {escrow.status.replace("_", " ")}
              </span>
            </div>
          </div>

          {/* ── Progress stepper ─────────────────────────────────────────── */}
          {!["disputed", "resolved", "refunded"].includes(escrow.status) && (
            <div className="mb-6">
              <div className="flex items-center gap-0">
                {DISPLAY_STEPS.map((s, i) => {
                  const done   = i < currentStepIdx;
                  const active = i === currentStepIdx;
                  return (
                    <div key={s.key} className="flex-1 flex flex-col items-center">
                      <div className="flex items-center w-full">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                          done && escrow.status !== "payment_rejected" ? "bg-primary border-primary" :
                          active && escrow.status === "payment_rejected" ? "bg-red-50 border-red-500" :
                          active ? "bg-primary/10 border-primary" :
                                   "bg-secondary border-border"
                        )}>
                          {done
                            ? <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                            : <span className={cn("text-xs font-bold",
                                active ? "text-primary" : "text-muted-foreground"
                              )}>{i + 1}</span>
                          }
                        </div>
                        {i < DISPLAY_STEPS.length - 1 && (
                          <div className={cn("flex-1 h-0.5", done ? "bg-primary" : "bg-border")} />
                        )}
                      </div>
                      <p className={cn(
                        "text-[9px] mt-1.5 text-center font-medium leading-tight max-w-[60px]",
                        active ? "text-primary" : "text-muted-foreground"
                      )}>
                        {s.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Disputed banner ───────────────────────────────────────────── */}
          {escrow.status === "disputed" && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">Dispute Open</span>
              </div>
              <p className="text-sm text-red-600">{escrow.disputeReason}</p>
              <p className="text-xs text-red-500 mt-2">
                Our team will review and resolve within 24 hours.
              </p>
            </div>
          )}

          {/* ── Timeline ──────────────────────────────────────────────────── */}
          <div className="space-y-2.5 mb-6">
            <h3 className="text-sm font-semibold text-foreground">Transaction Timeline</h3>
            {[
              { label: "Escrow initiated",              date: escrow.createdAt },
              { label: "Transfer submitted by buyer",   date: (escrow as any).transferSubmittedAt },
              { label: "Payment confirmed by HomveraX", date: escrow.depositPaidAt },
              { label: "Funds held securely",           date: escrow.fundsHeldAt },
              { label: "Inspection started",            date: escrow.inspectionDate },
              { label: "Funds released to seller",      date: escrow.releasedAt },
              { label: "Dispute opened",                date: escrow.disputeOpenedAt },
              { label: "Resolved",                      date: escrow.resolvedAt },
            ]
              .filter((t) => t.date)
              .map((t) => (
                <div key={t.label} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-foreground">{t.label}</span>
                  <span className="text-muted-foreground text-xs ml-auto">
                    {timeAgo(t.date!)}
                  </span>
                </div>
              ))}
            {/* Payment rejected — shown with a warning icon, not the green
                checkmark used above, since this isn't a forward-progress
                step. Kept separate from the main list so it's never hidden
                even if the buyer later resubmits and moves forward again. */}
            {escrow.rejectedAt && (
              <div className="flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-foreground">Payment rejected by HomveraX</span>
                <span className="text-muted-foreground text-xs ml-auto">
                  {timeAgo(escrow.rejectedAt)}
                </span>
              </div>
            )}
          </div>

          {/* ── Receipt download — only once funds have actually been
              released, since that's the only point a receipt is accurate.
              Visible to both buyer and seller on this transaction. ──────── */}
          {escrow.status === "released" && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-green-700">Transaction complete</p>
                <p className="text-xs text-green-600">Download your official payment receipt for this transaction.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-green-300 text-green-700 hover:bg-green-100"
                disabled={isDownloadingReceipt}
                onClick={handleDownloadReceipt}
              >
                {isDownloadingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download Receipt
              </Button>
            </div>
          )}

          {/* ── ACTION BUTTONS ────────────────────────────────────────────── */}

          <div className="space-y-3">

            {/* ── BUYER: Show bank transfer instructions ─────────────────── */}
            {isBuyer && escrow.status === "pending" && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                {/* Payment method — only rendered if admin has 2+ methods enabled */}
                <PaymentPicker className="mb-4" />

                {/* Online payment option — shown when Paystack/Flutterwave is
                    the chosen method (or the only enabled one) */}
                {payMethod && payMethod !== "manual" && (
                  <div className="mb-4">
                    <div className="bg-card rounded-xl p-4 mb-4 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Total amount to pay</p>
                      <p className="text-2xl font-serif font-bold text-primary">
                        {formatCurrency(totalPayable)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Includes {platformFee}% HomveraX escrow fee ({formatCurrency(escrow.buyerServiceCharge)})
                      </p>
                    </div>
                    <Button className="w-full gap-2" disabled={isPayingOnline} onClick={handlePayOnline}>
                      {isPayingOnline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      Pay {formatCurrency(totalPayable)} Now
                    </Button>
                  </div>
                )}

                {/* Manual bank transfer flow — shown when manual is chosen
                    (or the only enabled method) */}
                {(!payMethod || payMethod === "manual") && (
                  <>
                <div className="flex items-center gap-2 mb-4">
                  <BanknoteIcon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    Pay via Bank Transfer
                  </h3>
                </div>

                {/* Amount to pay */}
                <div className="bg-card rounded-xl p-4 mb-4 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Total amount to transfer</p>
                  <p className="text-2xl font-serif font-bold text-primary">
                    {formatCurrency(totalPayable)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Includes {platformFee}% HomveraX escrow fee ({formatCurrency(escrow.buyerServiceCharge)})
                  </p>
                </div>

                {/* Bank details */}
                <div className="space-y-3 mb-4">
                  {[
                    { label: "Bank",           value: bank.bankName },
                    { label: "Account Number", value: bank.accountNumber },
                    { label: "Account Name",   value: bank.accountName },
                    { label: "Sort Code",      value: bank.sortCode },
                    { label: "Reference",      value: `ESCROW-${escrow.id.slice(0, 8).toUpperCase()}`, highlight: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-3 rounded-xl",
                        item.highlight
                          ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30"
                          : "bg-secondary/50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className={cn(
                          "text-sm font-semibold mt-0.5",
                          item.highlight ? "text-amber-800 dark:text-amber-400 font-mono" : "text-foreground"
                        )}>
                          {item.value}
                        </p>
                      </div>
                      <button
                        onClick={() => copyText(item.value, item.label)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        title={`Copy ${item.label}`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Important note about reference */}
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl p-3 mb-4">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">
                    ⚠ Important
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    You <strong>must include the reference</strong> (ESCROW-{escrow.id.slice(0, 8).toUpperCase()}) in your transfer narration. This is how we match your payment to this transaction.
                  </p>
                </div>

                {/* Transfer reference + receipt upload — always visible so the
                    buyer can attach proof before confirming, not hidden
                    behind an extra click */}
                <div className="space-y-3 bg-secondary/50 p-4 rounded-xl">
                  <div>
                    <Label htmlFor="transfer-ref" className="text-sm font-medium text-foreground mb-1.5 block">
                      Transfer reference / teller number <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="transfer-ref"
                      placeholder="e.g. TRF/123456789 or your teller number"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="receipt-upload" className="text-sm font-medium text-foreground mb-1.5 block">
                      Payment receipt / screenshot <span className="text-destructive font-normal">(required)</span>
                    </Label>
                    <label
                      htmlFor="receipt-upload"
                      className="flex items-center gap-2 border border-dashed border-border rounded-xl px-3 py-2.5 text-sm cursor-pointer hover:bg-secondary/50 transition-colors"
                    >
                      {receiptFile ? (
                        <>
                          <FileImage className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate text-foreground">{receiptFile.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Attach a photo or screenshot of your receipt</span>
                        </>
                      )}
                    </label>
                    <input
                      id="receipt-upload"
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Uploaded receipts are visible to admin alongside your payment reference, as proof of transfer.
                    </p>
                  </div>
                </div>

                {/* Confirm transfer button */}
                <div className="space-y-2">
                  <Button
                    className="w-full gap-2"
                    disabled={isActing || isUploadingReceipt || !receiptFile}
                    onClick={handleSubmitTransfer}
                  >
                    {(isActing || isUploadingReceipt)
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CheckCircle2 className="w-4 h-4" />
                    }
                    {isUploadingReceipt ? "Uploading receipt…" : "I've Made the Transfer"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={isCancelling}
                    onClick={handleCancelOrder}
                  >
                    {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Cancel Order
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Unpaid orders are automatically deleted after 24 hours.
                  </p>
                </div>
                  </>
                )}
              </div>
            )}

            {/* ── BUYER: Awaiting admin confirmation ─────────────────────── */}
            {isBuyer && escrow.status === "awaiting_confirmation" && (
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/30 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-800 dark:text-blue-400">
                      Transfer Submitted — Awaiting Confirmation
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-0.5">
                      HomveraX is verifying your payment. This usually takes under 1 business hour.
                    </p>
                  </div>
                </div>
                {(escrow as any).transferReference && (
                  <div className="bg-white/60 dark:bg-white/5 rounded-xl px-4 py-3 text-sm">
                    <span className="text-muted-foreground text-xs">Your reference: </span>
                    <span className="font-mono font-semibold text-foreground">
                      {(escrow as any).transferReference}
                    </span>
                  </div>
                )}
                {(escrow as any).receiptUrl && (
                  <a
                    href={(escrow as any).receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-2 bg-white/60 dark:bg-white/5 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    <FileImage className="w-4 h-4 shrink-0" />
                    View uploaded receipt
                  </a>
                )}
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-3">
                  Questions? Email <a href="mailto:escrow@homverax.com" className="underline">escrow@homverax.com</a> with your reference number.
                </p>
              </div>
            )}

            {/* ── BUYER: Payment rejected — show reason + let them resubmit
                on this SAME order, no new escrow row created. Reuses the
                same transferRef/receiptFile state and submitTransferProof()
                call as the initial "pending" flow above; since receiptFile
                is component state (not persisted), the buyer is always
                forced to attach a fresh file here — the old rejected
                screenshot can't be silently resubmitted. ─────────────────── */}
            {isBuyer && escrow.status === "payment_rejected" && (
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/30 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-400">
                      Payment Rejected — Please Resubmit
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                      Your order is still reserved. Fix the issue below and resubmit — no need to start over.
                    </p>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-white/5 rounded-xl px-4 py-3 text-sm mb-4">
                  <p className="text-xs text-muted-foreground mb-1">Reason</p>
                  <p className="font-semibold text-red-700 dark:text-red-400">
                    {escrow.rejectionReason
                      ? PAYMENT_REJECTION_REASON_LABELS[escrow.rejectionReason]
                      : "Payment could not be confirmed"}
                  </p>
                  {escrow.rejectionNote && (
                    <>
                      <p className="text-xs text-muted-foreground mt-2.5 mb-1">Note from HomveraX</p>
                      <p className="text-foreground">{escrow.rejectionNote}</p>
                    </>
                  )}
                </div>

                {/* Bank details — repeated here so the buyer doesn't have
                    to scroll back up while fixing their transfer */}
                <div className="space-y-3 mb-4">
                  {[
                    { label: "Bank",           value: bank.bankName },
                    { label: "Account Number", value: bank.accountNumber },
                    { label: "Account Name",   value: bank.accountName },
                    { label: "Reference",      value: `ESCROW-${escrow.id.slice(0, 8).toUpperCase()}`, highlight: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-3 rounded-xl",
                        item.highlight
                          ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30"
                          : "bg-white/60 dark:bg-white/5"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className={cn(
                          "text-sm font-semibold mt-0.5",
                          item.highlight ? "text-amber-800 dark:text-amber-400 font-mono" : "text-foreground"
                        )}>
                          {item.value}
                        </p>
                      </div>
                      <button
                        onClick={() => copyText(item.value, item.label)}
                        className="p-1.5 rounded-lg hover:bg-white/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        title={`Copy ${item.label}`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Resubmit form — same fields/handler as the initial
                    submission, always starts empty so a fresh screenshot
                    is required. */}
                <div className="space-y-3 bg-white/60 dark:bg-white/5 p-4 rounded-xl mb-4">
                  <div>
                    <Label htmlFor="resubmit-ref" className="text-sm font-medium text-foreground mb-1.5 block">
                      Transfer reference / teller number <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="resubmit-ref"
                      placeholder="e.g. TRF/123456789 or your teller number"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="resubmit-receipt" className="text-sm font-medium text-foreground mb-1.5 block">
                      New payment receipt / screenshot <span className="text-destructive font-normal">(required)</span>
                    </Label>
                    <label
                      htmlFor="resubmit-receipt"
                      className="flex items-center gap-2 border border-dashed border-border rounded-xl px-3 py-2.5 text-sm cursor-pointer hover:bg-secondary/50 transition-colors"
                    >
                      {receiptFile ? (
                        <>
                          <FileImage className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate text-foreground">{receiptFile.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Attach a new photo or screenshot</span>
                        </>
                      )}
                    </label>
                    <input
                      id="resubmit-receipt"
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full gap-2 bg-red-600 hover:bg-red-700"
                    disabled={isActing || isUploadingReceipt || !receiptFile}
                    onClick={handleSubmitTransfer}
                  >
                    {(isActing || isUploadingReceipt)
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CheckCircle2 className="w-4 h-4" />
                    }
                    {isUploadingReceipt ? "Uploading receipt…" : "Resubmit Payment Proof"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={isCancelling}
                    onClick={handleCancelOrder}
                  >
                    {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Cancel Order Instead
                  </Button>
                </div>
              </div>
            )}

            {/* ── SELLER: Confirm receipt of payment ─────────────────────── */}
            {isSeller && escrow.status === "funded" && (
              <Button
                className="w-full gap-2"
                disabled={isActing}
                onClick={() => act(() => holdEscrow(id), "Confirmed — funds are now held securely.")}
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Confirm Receipt of Payment
              </Button>
            )}

            {/* ── SELLER: Start inspection ────────────────────────────────── */}
            {isSeller && escrow.status === "held" && (
              <Button
                className="w-full gap-2"
                disabled={isActing}
                onClick={() => act(
                  () => startInspection(id, new Date().toISOString()),
                  "Inspection period started."
                )}
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                Start Inspection Period
              </Button>
            )}

            {/* ── BUYER: Confirm delivery & release funds ─────────────────── */}
            {isBuyer && escrow.status === "inspection" && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                disabled={isActing}
                onClick={() => act(
                  () => confirmDelivery(id),
                  "Confirmed! Funds released to seller."
                )}
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm & Release Funds to Seller
              </Button>
            )}

            {/* ── BUYER: Open dispute ──────────────────────────────────────── */}
            {isBuyer && ["held", "inspection"].includes(escrow.status) && !showDispute && (
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => setShowDispute(true)}
              >
                <AlertTriangle className="w-4 h-4" />
                Open Dispute
              </Button>
            )}

            {showDispute && (
              <div className="space-y-3 p-4 bg-secondary/50 rounded-xl">
                <p className="text-sm font-medium text-foreground">Describe the issue</p>
                <Textarea
                  placeholder="Explain why you're opening a dispute…"
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive" size="sm" className="flex-1"
                    onClick={handleDisputeSubmit}
                    disabled={isActing || !disputeReason.trim()}
                  >
                    {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Dispute"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowDispute(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Safety note ───────────────────────────────────────────────── */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-primary inline mr-1.5 relative -top-0.5" />
          Funds are only released when you confirm satisfaction. Questions?{" "}
          <a href="mailto:escrow@homverax.com" className="text-primary hover:underline">
            escrow@homverax.com
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
