"use client";

import { useEffect, useState } from "react";
import { Wallet, ArrowDownToLine, TrendingUp, Clock, CheckCircle2, XCircle, Copy, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
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

interface Bank { name: string; code: string; }

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<SellerWallet | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPayout, setShowPayout] = useState(false);
  const [amount, setAmount] = useState("");

  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState(user?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(user?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(user?.accountName ?? "");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [resolveError, setResolveError] = useState("");
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

  // Load Paystack's bank list once — gives us the bank_code Paystack's
  // Transfers API requires. A free-text bank name isn't enough for
  // automatic payout to work.
  useEffect(() => {
    fetch("/api/payments/banks")
      .then((res) => res.json())
      .then((data) => {
        if (data.banks) setBanks(data.banks);
        else setBanksError(true);
      })
      .catch(() => setBanksError(true))
      .finally(() => setBanksLoading(false));
  }, []);

  // Auto-verify the account name once bank + a full 10-digit account
  // number are selected. Catches typos before submission — same
  // protection whether the platform is currently in manual or Paystack
  // payout mode, since a wrong account number is a mistake either way.
  useEffect(() => {
    setResolved(false);
    setResolveError("");
    setAccountName("");

    if (!bankCode || accountNumber.length !== 10) return;

    let cancelled = false;
    setResolving(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/payments/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountNumber, bankCode }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.accountName) {
          setResolveError(data.error || "Could not verify this account. Double-check the number and bank.");
          return;
        }
        setAccountName(data.accountName);
        setResolved(true);
      } catch {
        if (!cancelled) setResolveError("Could not verify account — check your connection and try again.");
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 500);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [bankCode, accountNumber]);

  const handlePayout = async () => {
    if (!user || !wallet) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!bankCode) { toast.error("Select your bank"); return; }
    if (accountNumber.length !== 10) { toast.error("Enter a valid 10-digit account number"); return; }
    if (!resolved || !accountName.trim()) { toast.error("We couldn't verify this account — check the details."); return; }

    setSubmitting(true);
    try {
      await requestPayout(user.id, user.name, amt, bankName, accountNumber, accountName, bankCode);
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
                <Label>Bank</Label>
                {banksError ? (
                  <p className="text-xs text-destructive mt-1">Could not load bank list. Please try again shortly.</p>
                ) : (
                  <Select
                    value={bankCode}
                    onValueChange={(code) => {
                      setBankCode(code);
                      setBankName(banks.find((b) => b.code === code)?.name ?? "");
                    }}
                    disabled={banksLoading}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={banksLoading ? "Loading banks…" : "Select your bank"} />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label>Account Number</Label>
                <Input
                  placeholder="10-digit account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="mt-1"
                  maxLength={10}
                  inputMode="numeric"
                />
              </div>

              <div>
                <Label>Account Name</Label>
                <div className="relative mt-1">
                  <Input value={accountName} placeholder="Auto-verified from bank + account number" readOnly disabled />
                  {resolving && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                  {resolved && !resolving && <CheckCircle2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />}
                  {resolveError && !resolving && <XCircle className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-destructive" />}
                </div>
                {resolveError && <p className="text-xs text-destructive mt-1">{resolveError}</p>}
                {resolved && <p className="text-xs text-green-600 mt-1">Account verified ✓ — this is who will receive the payout.</p>}
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={handlePayout} disabled={submitting || !resolved}>
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
