"use client";

import { useEffect, useState } from "react";
import { Wallet, ArrowDownToLine, TrendingUp, Clock, CheckCircle2, XCircle, Copy } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  getOrCreateWallet, getWalletTransactions, requestPayout,
  type SellerWallet, type WalletTransaction,
} from "@/services/wallet";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPE_CONFIG = {
  credit:  { label: "Credit",  color: "text-green-600",  bg: "bg-green-50",  icon: CheckCircle2 },
  hold:    { label: "Held",    color: "text-yellow-600", bg: "bg-yellow-50", icon: Clock },
  debit:   { label: "Debit",   color: "text-red-600",    bg: "bg-red-50",    icon: XCircle },
  release: { label: "Release", color: "text-blue-600",   bg: "bg-blue-50",   icon: CheckCircle2 },
  payout:  { label: "Payout",  color: "text-purple-600", bg: "bg-purple-50", icon: ArrowDownToLine },
  fee_deduction: { label: "Fee", color: "text-orange-600", bg: "bg-orange-50", icon: XCircle },
};

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<SellerWallet | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPayout, setShowPayout] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState(user?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(user?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(user?.accountName ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getOrCreateWallet(user.id),
      getWalletTransactions(user.id),
    ]).then(([w, t]) => { setWallet(w); setTxns(t); })
      .catch(() => toast.error("Failed to load wallet"))
      .finally(() => setIsLoading(false));
  }, [user]);

  const handlePayout = async () => {
    if (!user || !wallet) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!bankName.trim()) { toast.error("Enter bank name"); return; }
    if (!accountNumber.trim()) { toast.error("Enter account number"); return; }
    if (!accountName.trim()) { toast.error("Enter account name"); return; }

    setSubmitting(true);
    try {
      await requestPayout(user.id, user.name, amt, bankName, accountNumber, accountName);
      toast.success("Payout requested! Admin will process within 24 hours.");
      setShowPayout(false);
      setAmount("");
      const updated = await getOrCreateWallet(user.id);
      setWallet(updated);
    } catch (err: any) {
      toast.error(err.message ?? "Payout request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" /> My Wallet
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Track your escrow earnings and request payouts</p>
      </div>

      {/* Stats */}
      {wallet && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
            <p className="text-2xl font-serif font-bold text-green-600">{formatCurrency(wallet.balance)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-xs text-muted-foreground mb-1">Pending (In Escrow)</p>
            <p className="text-2xl font-serif font-bold text-yellow-600">{formatCurrency(wallet.pendingBalance)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
            <p className="text-2xl font-serif font-bold text-foreground">{formatCurrency(wallet.totalEarned)}</p>
          </div>
        </div>
      )}

      {/* Payout */}
      {wallet && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground">Request Payout</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Available: <strong>{formatCurrency(wallet.balance)}</strong></p>
            </div>
            {!showPayout && (
              <Button onClick={() => setShowPayout(true)} disabled={wallet.balance <= 0} className="gap-2">
                <ArrowDownToLine className="w-4 h-4" /> Withdraw
              </Button>
            )}
          </div>

          {showPayout && (
            <div className="space-y-3 bg-secondary/40 rounded-xl p-4">
              <div>
                <Label>Amount (₦)</Label>
                <Input type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Bank Name</Label>
                <Input placeholder="e.g. First Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input placeholder="10-digit account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="mt-1" maxLength={10} />
              </div>
              <div>
                <Label>Account Name</Label>
                <Input placeholder="Name on account" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="mt-1" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={handlePayout} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Payout Request"}
                </Button>
                <Button variant="outline" onClick={() => setShowPayout(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Transaction History
        </h2>
        {txns.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No transactions yet. Complete an escrow deal to earn.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {txns.map((t) => {
              const cfg = TYPE_CONFIG[t.type] ?? TYPE_CONFIG.credit;
              const Icon = cfg.icon;
              const isPositive = ["credit", "release"].includes(t.type);
              return (
                <div key={t.id} className="py-3 flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                    <Icon className={cn("w-4 h-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p>
                  </div>
                  <p className={cn("text-sm font-bold shrink-0", isPositive ? "text-green-600" : "text-red-500")}>
                    {isPositive ? "+" : "-"}{formatCurrency(t.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
