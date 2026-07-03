"use client";

import { useEffect, useState } from "react";
import {
  AlertOctagon, BanknoteIcon, Building2, CheckCircle2, Copy,
  Clock, Loader2, Search, Shield, Trash2, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAllEscrows, adminConfirmFunding, resolveDispute, releaseToSeller, getSellerBankDetails, adminDeleteEscrow } from "@/services/escrow";
import { getPlatformConfig, type BankDetails } from "@/services/platformSettings";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EscrowTransaction } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  pending:                "bg-yellow-100 text-yellow-700",
  awaiting_confirmation:  "bg-blue-100 text-blue-700 font-bold",
  funded:                 "bg-indigo-100 text-indigo-700",
  held:                   "bg-purple-100 text-purple-700",
  inspection:             "bg-orange-100 text-orange-700",
  released:               "bg-green-100 text-green-700",
  disputed:               "bg-red-100 text-red-700",
  resolved:               "bg-gray-100 text-gray-600",
  refunded:               "bg-orange-100 text-orange-700",
};

export default function AdminEscrowsPage() {
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [filtered, setFiltered] = useState<EscrowTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("awaiting_confirmation");
  const [acting, setActing] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sellerBanks, setSellerBanks] = useState<Record<string, { bankName: string; accountNumber: string; accountName: string } | null>>({});
  const [releaseRefs, setReleaseRefs] = useState<Record<string, string>>({});
  const [bank, setBank] = useState<BankDetails>({
    bankName: "—", accountNumber: "—", accountName: "—", sortCode: "—",
  });

  useEffect(() => {
    Promise.all([getAllEscrows(), getPlatformConfig()])
      .then(([e, cfg]) => { setEscrows(e); setBank(cfg.bank); })
      .catch(() => toast.error("Failed to load escrows"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    let result = escrows;
    if (statusFilter !== "all") result = result.filter((e) => e.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.listingTitle?.toLowerCase().includes(q) ||
          e.buyerId?.includes(q) ||
          e.sellerId?.includes(q) ||
          (e as any).transferReference?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [searchQuery, statusFilter, escrows]);

  const handleConfirmFunding = async (escrow: EscrowTransaction) => {
    setActing(escrow.id);
    try {
      const note = adminNotes[escrow.id];
      await adminConfirmFunding(escrow.id, note);
      setEscrows((prev) =>
        prev.map((e) => e.id === escrow.id ? { ...e, status: "funded" } : e)
      );
      toast.success(`Payment confirmed for "${escrow.listingTitle}"`);
    } catch {
      toast.error("Failed to confirm payment");
    } finally {
      setActing(null);
    }
  };

  const fetchSellerBank = async (sellerId: string) => {
    if (sellerBanks[sellerId] !== undefined) return;
    const details = await getSellerBankDetails(sellerId);
    setSellerBanks((prev) => ({ ...prev, [sellerId]: details }));
  };

  const handleReleaseToSeller = async (escrow: EscrowTransaction) => {
    const note = adminNotes[escrow.id] ?? "";
    const ref = releaseRefs[escrow.id] ?? "";
    if (!ref.trim()) { toast.error("Enter your bank transfer reference"); return; }
    setActing(escrow.id);
    try {
      await releaseToSeller(escrow.id, note, ref);
      setEscrows((prev) =>
        prev.map((e) => e.id === escrow.id ? { ...e, status: "released" } : e)
      );
      toast.success(`Funds released to seller for "${escrow.listingTitle}"`);
    } catch {
      toast.error("Failed to release funds");
    } finally {
      setActing(null);
    }
  };

  const handleRejectTransfer = async (escrow: EscrowTransaction) => {
    setActing(escrow.id);
    try {
      // Move back to pending so buyer can re-submit
      const { updateEscrowStatus } = await import("@/services/escrow");
      await updateEscrowStatus(escrow.id, "pending");
      setEscrows((prev) =>
        prev.map((e) => e.id === escrow.id ? { ...e, status: "pending" } : e)
      );
      toast.success("Transfer rejected — buyer notified to re-submit");
    } catch {
      toast.error("Failed to reject transfer");
    } finally {
      setActing(null);
    }
  };

  const handleDeleteEscrow = async (escrow: EscrowTransaction) => {
    if (!window.confirm(
      `Permanently delete this escrow ("${escrow.listingTitle}")? This removes it from the database entirely and cannot be undone.`
    )) return;
    setActing(escrow.id);
    try {
      await adminDeleteEscrow(escrow.id);
      setEscrows((prev) => prev.filter((e) => e.id !== escrow.id));
      toast.success("Escrow permanently deleted");
    } catch {
      toast.error("Failed to delete escrow");
    } finally {
      setActing(null);
    }
  };

  const awaitingCount = escrows.filter((e) => e.status === "awaiting_confirmation").length;
  const disputedCount = escrows.filter((e) => e.status === "disputed").length;
  const totalHeld = escrows
    .filter((e) => ["funded", "held", "inspection"].includes(e.status))
    .reduce((acc, e) => acc + e.amount, 0);

  const counts: Record<string, number> = {
    all:                    escrows.length,
    awaiting_confirmation:  awaitingCount,
    pending:                escrows.filter((e) => e.status === "pending").length,
    funded:                 escrows.filter((e) => e.status === "funded").length,
    held:                   escrows.filter((e) => e.status === "held").length,
    inspection:             escrows.filter((e) => e.status === "inspection").length,
    released:               escrows.filter((e) => e.status === "released").length,
    disputed:               disputedCount,
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Escrow Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {escrows.length} total transactions · {formatCurrency(totalHeld)} currently held
          {awaitingCount > 0 && (
            <span className="ml-2 font-semibold text-blue-600">
              · {awaitingCount} awaiting confirmation
            </span>
          )}
          {disputedCount > 0 && (
            <span className="ml-2 font-semibold text-red-600">
              · {disputedCount} disputed
            </span>
          )}
        </p>
      </div>

      {/* Your bank account reminder */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <BanknoteIcon className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Your Escrow Account</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Bank</p>
            <p className="font-semibold text-foreground mt-0.5">{bank.bankName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Account Number</p>
            <p className="font-mono font-semibold text-foreground mt-0.5">{bank.accountNumber}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Account Name</p>
            <p className="font-semibold text-foreground mt-0.5">{bank.accountName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Confirm payment by</p>
            <p className="font-semibold text-foreground mt-0.5">Checking your bank app</p>
          </div>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {[
          { key: "awaiting_confirmation", label: "Awaiting Confirmation" },
          { key: "all",       label: "All" },
          { key: "pending",   label: "Pending" },
          { key: "funded",    label: "Funded" },
          { key: "held",      label: "Held" },
          { key: "inspection",label: "Inspection" },
          { key: "disputed",  label: "Disputed" },
          { key: "released",  label: "Released" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
              statusFilter === s.key
                ? s.key === "awaiting_confirmation"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            )}
          >
            {s.label}
            {counts[s.key] > 0 && (
              <span className={cn(
                "ml-1.5 text-[10px] font-bold px-1 py-0.5 rounded-full",
                statusFilter === s.key ? "bg-white/20" : "bg-secondary"
              )}>
                {counts[s.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 mb-5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search by title, buyer/seller ID, or transfer reference…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground text-sm">
            {statusFilter === "awaiting_confirmation"
              ? "No transfers waiting for confirmation — you're all caught up!"
              : "No transactions found"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const isAwaiting = e.status === "awaiting_confirmation";
            const isDisputed = e.status === "disputed";
            const isExpanded = expandedId === e.id;
            const transferRef = (e as any).transferReference as string | undefined;

            return (
              <div
                key={e.id}
                className={cn(
                  "bg-card border rounded-2xl overflow-hidden transition-all",
                  isAwaiting ? "border-blue-300 dark:border-blue-700/50 shadow-sm shadow-blue-100 dark:shadow-blue-900/20" :
                  isDisputed ? "border-red-300 dark:border-red-700/50" :
                  "border-border"
                )}
              >
                {/* Row header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : e.id)}
                >
                  {/* Icon */}
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    isAwaiting ? "bg-blue-100 dark:bg-blue-900/30" :
                    isDisputed ? "bg-red-100 dark:bg-red-900/30" :
                    "bg-primary/10"
                  )}>
                    {isAwaiting
                      ? <Clock className="w-5 h-5 text-blue-600" />
                      : isDisputed
                      ? <AlertOctagon className="w-5 h-5 text-red-500" />
                      : <Shield className="w-5 h-5 text-primary" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {e.listingTitle}
                      </p>
                      {isAwaiting && (
                        <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                          ACTION NEEDED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo(e.createdAt)}
                      {transferRef && (
                        <span className="ml-2 font-mono text-blue-600 dark:text-blue-400">
                          Ref: {transferRef}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Amount + status */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(e.amount)}
                    </p>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize",
                      STATUS_COLOR[e.status] ?? "bg-secondary text-secondary-foreground"
                    )}>
                      {e.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 bg-secondary/20 space-y-4">

                    {/* Details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Escrow amount</p>
                        <p className="font-semibold text-foreground mt-0.5">{formatCurrency(e.amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Buyer fee ({e.buyerServiceChargePercent}%)</p>
                        <p className="font-semibold text-foreground mt-0.5">{formatCurrency(e.buyerServiceCharge)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total received</p>
                        <p className="font-semibold text-foreground mt-0.5">{formatCurrency(e.amount + e.buyerServiceCharge)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Buyer ID</p>
                        <p className="font-mono font-semibold text-foreground mt-0.5 truncate">{e.buyerId}</p>
                      </div>
                    </div>

                    {/* Transfer reference */}
                    {transferRef && (
                      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/30 rounded-xl p-3">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                          Buyer's Transfer Reference
                        </p>
                        <p className="font-mono text-sm font-bold text-blue-800 dark:text-blue-300">
                          {transferRef}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Check your bank app for a transfer with this reference of{" "}
                          <strong>{formatCurrency(e.amount + e.buyerServiceCharge)}</strong>.
                        </p>
                      </div>
                    )}

                    {/* Payment receipt — shown independently of the reference,
                        since a buyer can attach a receipt without typing a
                        reference (reference is optional, receipt is required) */}
                    {(e as any).receiptUrl ? (
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700/30 rounded-xl p-3">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                          Payment Receipt (buyer-uploaded)
                        </p>
                        <a
                          href={(e as any).receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(ev) => ev.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 underline"
                        >
                          View uploaded receipt →
                        </a>
                      </div>
                    ) : isAwaiting ? (
                      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl p-3">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          No receipt attached — this order was submitted without a payment receipt.
                        </p>
                      </div>
                    ) : null}

                    {/* Admin note */}
                    {isAwaiting && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Admin note (optional — shown in timeline)
                        </label>
                        <Input
                          placeholder="e.g. Confirmed on GTB app at 2:34pm"
                          value={adminNotes[e.id] ?? ""}
                          onChange={(ev) => setAdminNotes((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          className="text-sm h-9"
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    {isAwaiting && (
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                          disabled={acting === e.id}
                          onClick={() => handleConfirmFunding(e)}
                        >
                          {acting === e.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CheckCircle2 className="w-4 h-4" />
                          }
                          Confirm Payment Received
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                          disabled={acting === e.id}
                          onClick={() => handleRejectTransfer(e)}
                        >
                          {acting === e.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <X className="w-4 h-4" />
                          }
                          Reject — Ask Buyer to Re-submit
                        </Button>
                      </div>
                    )}

                    {/* Seller bank details + Release */}
                    {(e.status === "held" || e.status === "inspection" || e.status === "disputed") && (() => {
                      // Fetch seller bank lazily
                      if (sellerBanks[e.sellerId] === undefined) fetchSellerBank(e.sellerId);
                      const sb = sellerBanks[e.sellerId];
                      return (
                        <div className="space-y-3">
                          {/* Seller bank info */}
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                            <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> Seller Bank Details
                            </p>
                            {sb === undefined ? (
                              <p className="text-xs text-muted-foreground">Loading…</p>
                            ) : sb === null ? (
                              <p className="text-xs text-red-600 font-medium">⚠ Seller has not added bank details yet</p>
                            ) : (
                              <div className="space-y-1">
                                {[
                                  { label: "Bank", value: sb.bankName },
                                  { label: "Account", value: sb.accountNumber },
                                  { label: "Name", value: sb.accountName },
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">{label}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-foreground font-mono">{value}</span>
                                      <button onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`); }}>
                                        <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Release form */}
                          <Input
                            placeholder="Your bank transfer reference (required)"
                            value={releaseRefs[e.id] ?? ""}
                            onChange={(ev) => setReleaseRefs((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                            className="text-sm"
                          />

                          {/* Dispute or release buttons */}
                          {e.status === "disputed" ? (
                            <div className="flex gap-2">
                              <Button
                                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                                disabled={acting === e.id}
                                onClick={() => handleReleaseToSeller(e)}
                              >
                                {acting === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Resolve — Pay Seller
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 gap-2 border-red-200 text-red-600 hover:bg-red-50"
                                disabled={acting === e.id}
                                onClick={async () => {
                                  setActing(e.id);
                                  try {
                                    await resolveDispute(e.id, true);
                                    setEscrows((prev) => prev.map((x) => x.id === e.id ? { ...x, status: "refunded" } : x));
                                    toast.success("Refund issued to buyer");
                                  } catch { toast.error("Failed"); }
                                  finally { setActing(null); }
                                }}
                              >
                                Refund Buyer
                              </Button>
                            </div>
                          ) : (
                            <Button
                              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                              disabled={acting === e.id || !releaseRefs[e.id]?.trim()}
                              onClick={() => handleReleaseToSeller(e)}
                            >
                              {acting === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              Release Funds to Seller
                            </Button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Legacy dispute resolution (refund only) */}
                    {false && (
                      <div className="flex gap-3" />
                    )}

                    {/* Admin: permanent delete — available regardless of status */}
                    <div className="border-t border-border pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                        disabled={acting === e.id}
                        onClick={(ev) => { ev.stopPropagation(); handleDeleteEscrow(e); }}
                      >
                        {acting === e.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                        Delete Permanently
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
