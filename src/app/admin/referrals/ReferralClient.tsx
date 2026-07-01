"use client";

import { useEffect, useState } from "react";
import {
  Copy, Gift, Users, Wallet, ArrowDownToLine,
  CheckCircle2, Clock, XCircle, TrendingUp, Link2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  getOrCreateReferralProfile, getReferralEarnings, getReferralConfig,
  requestWithdrawal,
  type ReferralProfile, type ReferralEarning, type ReferralConfig,
} from "@/services/referral";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ReferralPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ReferralProfile | null>(null);
  const [earnings, setEarnings] = useState<ReferralEarning[]>([]);
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getOrCreateReferralProfile(user.id, user.name),
      getReferralEarnings(user.id),
      getReferralConfig(),
    ]).then(([p, e, c]) => {
      setProfile(p);
      setEarnings(e);
      setConfig(c);
    }).catch(() => toast.error("Failed to load referral data"))
      .finally(() => setIsLoading(false));
  }, [user]);

  const referralLink = profile
    ? `${APP_URL}/register?ref=${profile.referralCode}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  const copyCode = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.referralCode);
    toast.success("Referral code copied!");
  };

  const handleWithdraw = async () => {
    if (!user || !profile || !config) return;
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!bankName.trim()) { toast.error("Enter your bank name"); return; }
    if (!accountNumber.trim()) { toast.error("Enter your account number"); return; }
    if (!accountName.trim()) { toast.error("Enter your account name"); return; }

    setIsWithdrawing(true);
    try {
      await requestWithdrawal(
        user.id, user.name, amount,
        bankName, accountNumber, accountName
      );
      toast.success("Withdrawal request submitted! Admin will process within 24 hours.");
      setShowWithdraw(false);
      setWithdrawAmount("");
      // Refresh profile
      const updated = await getOrCreateReferralProfile(user.id, user.name);
      setProfile(updated);
    } catch (err: any) {
      toast.error(err.message ?? "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          Referral Program
        </h1>
        <p className="text-muted-foreground mt-1">
          Invite people to HomveraX and earn when they sign up or complete a transaction.
        </p>
      </div>

      {/* How it works */}
      {config && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">1. Share your link</p>
              <p className="text-xs text-muted-foreground mt-1">Share your unique referral link with anyone</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">2. They register</p>
              <p className="text-xs text-muted-foreground mt-1">
                Earn <span className="font-bold text-green-600">{formatCurrency(config.signupBonus)}</span> when they sign up
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-2">
                <Wallet className="w-5 h-5 text-accent-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">3. They transact</p>
              <p className="text-xs text-muted-foreground mt-1">
                Earn{" "}
                <span className="font-bold text-accent-foreground">
                  {config.usePercent
                    ? `${config.transactionPercent}% of escrow`
                    : formatCurrency(config.transactionBonus)}
                </span>{" "}
                per completed deal
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Minimum withdrawal: <strong>{formatCurrency(config.minimumWithdrawal)}</strong>
          </p>
        </div>
      )}

      {/* Stats */}
      {profile && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
            <p className="text-xl font-serif font-bold text-primary">{formatCurrency(profile.totalEarnings)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Available</p>
            <p className="text-xl font-serif font-bold text-green-600">{formatCurrency(profile.pendingBalance)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Withdrawn</p>
            <p className="text-xl font-serif font-bold text-foreground">{formatCurrency(profile.withdrawnTotal)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Referrals</p>
            <p className="text-xl font-serif font-bold text-foreground">{profile.totalReferrals}</p>
          </div>
        </div>
      )}

      {/* Referral link */}
      {profile && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-foreground mb-4">Your Referral Link</h2>
          <div className="flex gap-2 mb-3">
            <Input
              value={referralLink}
              readOnly
              className="text-xs text-muted-foreground bg-secondary/50"
            />
            <Button onClick={copyLink} className="shrink-0 gap-1">
              <Copy className="w-4 h-4" /> Copy Link
            </Button>
          </div>
          <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Referral Code</p>
              <p className="font-mono font-bold text-foreground text-lg">{profile.referralCode}</p>
            </div>
            <Button variant="outline" size="sm" onClick={copyCode} className="gap-1">
              <Copy className="w-3 h-3" /> Copy Code
            </Button>
          </div>
        </div>
      )}

      {/* Withdraw */}
      {profile && config && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground">Withdraw Earnings</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Available: <strong>{formatCurrency(profile.pendingBalance)}</strong>
                {" · "}Min: <strong>{formatCurrency(config.minimumWithdrawal)}</strong>
              </p>
            </div>
            {!showWithdraw && (
              <Button
                onClick={() => setShowWithdraw(true)}
                disabled={profile.pendingBalance < config.minimumWithdrawal}
                className="gap-2"
              >
                <ArrowDownToLine className="w-4 h-4" />
                Withdraw
              </Button>
            )}
          </div>

          {showWithdraw && (
            <div className="space-y-3 bg-secondary/40 rounded-xl p-4">
              <div>
                <Label>Amount (₦)</Label>
                <Input
                  type="number"
                  placeholder={`Min ₦${config.minimumWithdrawal.toLocaleString()}`}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Bank Name</Label>
                <Input
                  placeholder="e.g. First Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input
                  placeholder="10-digit account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="mt-1"
                  maxLength={10}
                />
              </div>
              <div>
                <Label>Account Name</Label>
                <Input
                  placeholder="Name on account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                >
                  {isWithdrawing ? "Submitting…" : "Submit Request"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowWithdraw(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Earnings history */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Earnings History</h2>
        {earnings.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Gift className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No earnings yet. Share your link to get started!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {earnings.map((e) => (
              <div key={e.id} className="py-3 flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  e.type === "signup" ? "bg-green-500/10" : "bg-primary/10"
                )}>
                  {e.type === "signup"
                    ? <Users className="w-4 h-4 text-green-500" />
                    : <CheckCircle2 className="w-4 h-4 text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {e.type === "signup" ? "New signup" : "Transaction bonus"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {e.referredUserName} · {timeAgo(e.createdAt)}
                  </p>
                </div>
                <p className="text-sm font-bold text-green-600 shrink-0">
                  +{formatCurrency(e.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
