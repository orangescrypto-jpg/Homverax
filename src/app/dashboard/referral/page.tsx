"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, Clock, Copy, Gift,
  Loader2, Share2, Users, Wallet, X, AlertCircle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  getOrCreateReferralProfile,
  getReferralEarnings,
  getMyReferrals,
  requestWithdrawal,
} from "@/services/referral";
import { getBankDetails } from "@/services/wallet";
import { getPlatformConfig } from "@/services/platformSettings";
import { formatCurrency, timeAgo } from "@/lib/utils";
import type { ReferralProfile, ReferralEarning, ReferralLink } from "@/services/referral";
import type { ReferralTierConfig } from "@/services/platformSettings";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, string> = {
  signup: "Signup Bonus",
  welcome: "Welcome Bonus",
  first_transaction: "First Deal Bonus",
  recurring: "Recurring Bonus",
};

const TYPE_COLOR: Record<string, string> = {
  signup: "bg-blue-100 text-blue-700",
  welcome: "bg-purple-100 text-purple-700",
  first_transaction: "bg-green-100 text-green-700",
  recurring: "bg-amber-100 text-amber-700",
};

export default function ReferralPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ReferralProfile | null>(null);
  const [earnings, setEarnings] = useState<ReferralEarning[]>([]);
  const [referrals, setReferrals] = useState<ReferralLink[]>([]);
  const [tiers, setTiers] = useState<ReferralTierConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Withdrawal modal
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
      getMyReferrals(user.id),
      getPlatformConfig(),
      getBankDetails(user.id),
    ]).then(([p, e, r, cfg, bank]) => {
      setProfile(p);
      setEarnings(e);
      setReferrals(r);
      setTiers(cfg.referralTiers);
      if (bank) {
        setBankName(bank.bankName);
        setAccountNumber(bank.accountNumber);
        setAccountName(bank.accountName);
      }
    }).finally(() => setIsLoading(false));
  }, [user]);

  const referralLink = profile
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${profile.referralCode}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Join HomveraX — Nigeria's trusted property marketplace! 🏠\n\nUse my referral link to get a welcome bonus when you sign up:\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleWithdraw = async () => {
    if (!user || !profile) return;
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!bankName || !accountNumber || !accountName) {
      toast.error("Fill in all bank details");
      return;
    }
    setIsWithdrawing(true);
    try {
      await requestWithdrawal(
        user.id, user.name, amount, bankName, accountNumber, accountName,
      );
      toast.success("Withdrawal request submitted! Admin will process within 1-2 business days.");
      setShowWithdraw(false);
      setWithdrawAmount("");
      // Refresh profile
      const updated = await getOrCreateReferralProfile(user.id, user.name);
      setProfile(updated);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!tiers?.enabled) {
    return (
      <DashboardLayout>
        <div className="max-w-lg">
          <div className="text-center py-16 text-muted-foreground">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Referral program is currently unavailable.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Referral Program</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite friends and earn cash rewards for every successful referral.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Referrals</span>
              </div>
              <p className="text-3xl font-serif font-bold">{profile?.totalReferrals ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {profile?.convertedReferrals ?? 0} converted
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Earned</span>
              </div>
              <p className="text-3xl font-serif font-bold text-foreground">
                {formatCurrency(profile?.totalEarnings ?? 0)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Available</span>
              </div>
              <p className="text-3xl font-serif font-bold text-green-600">
                {formatCurrency(profile?.pendingBalance ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Min. withdraw: {formatCurrency(tiers?.minimumWithdrawal ?? 5000)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground">Withdrawn</span>
              </div>
              <p className="text-3xl font-serif font-bold">
                {formatCurrency(profile?.withdrawnTotal ?? 0)}
              </p>
            </div>
          </div>

          {/* Referral link card */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-foreground mb-1">Your Referral Link</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Share this link. When someone registers and completes a transaction, you earn.
            </p>
            <div className="flex gap-2 mb-4">
              <Input
                readOnly
                value={referralLink}
                className="text-xs font-mono flex-1 bg-secondary/50"
              />
              <Button variant="outline" size="icon" onClick={copyLink} className="shrink-0">
                {copied
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <Copy className="w-4 h-4" />
                }
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={shareWhatsApp}
                className="gap-2 bg-[#25D366] hover:bg-[#1da851] text-white flex-1"
              >
                <Share2 className="w-4 h-4" />
                Share on WhatsApp
              </Button>
              {(profile?.pendingBalance ?? 0) >= (tiers?.minimumWithdrawal ?? 5000) && (
                <Button
                  onClick={() => setShowWithdraw(true)}
                  className="gap-2 flex-1"
                >
                  <Wallet className="w-4 h-4" />
                  Withdraw
                </Button>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-foreground mb-4">How You Earn</h2>
            <div className="space-y-3">
              {tiers?.signupBonusEnabled && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Friend signs up</p>
                    <p className="text-xs text-muted-foreground">
                      Earn {formatCurrency(tiers.signupBonusAmount)} + role bonus immediately
                    </p>
                  </div>
                </div>
              )}
              {tiers?.firstTransactionBonusEnabled && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">First deal completed</p>
                    <p className="text-xs text-muted-foreground">
                      Earn {formatCurrency(tiers.firstTransactionBonusAmount)} when they complete their first escrow
                    </p>
                  </div>
                </div>
              )}
              {tiers?.recurringBonusEnabled && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Every subsequent deal</p>
                    <p className="text-xs text-muted-foreground">
                      Earn {tiers.recurringBonusUsePercent
                        ? `${tiers.recurringBonusPercent}% of each deal`
                        : formatCurrency(tiers.recurringBonusFlat)
                      } on every transaction they make
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Role bonus table */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-3">Extra bonus by referred user type:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Agent", amount: tiers?.agentReferralBonus ?? 0 },
                  { label: "Landlord", amount: tiers?.landlordReferralBonus ?? 0 },
                  { label: "Service Provider", amount: tiers?.serviceProviderReferralBonus ?? 0 },
                  { label: "Tenant/Buyer", amount: tiers?.tenantReferralBonus ?? 0 },
                ].map(({ label, amount }) => (
                  <div key={label} className="flex items-center justify-between bg-secondary/50 rounded-xl px-3 py-2">
                    <span className="text-xs text-foreground">{label}</span>
                    <span className="text-xs font-semibold text-primary">+{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* People I referred */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-foreground mb-4">
              People You Referred ({referrals.length})
            </h2>
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No referrals yet. Share your link to start earning!
              </p>
            ) : (
              <div className="space-y-3">
                {referrals.map((r) => (
                  <div key={r.referredUserId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.referredUserName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.referredUserRole.replace("_", " ")} • {timeAgo(r.createdAt)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === "converted"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {r.status === "converted" ? "Converted" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Earnings history */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-foreground mb-4">Earnings History</h2>
            {earnings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No earnings yet. Start referring to earn!
              </p>
            ) : (
              <div className="space-y-3">
                {earnings.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[e.type] ?? "bg-secondary text-secondary-foreground"}`}>
                        {TYPE_LABEL[e.type] ?? e.type}
                      </span>
                      <div>
                        <p className="text-sm text-foreground">{e.referredUserName}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-green-600">+{formatCurrency(e.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdrawal modal */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-foreground text-lg">Withdraw Earnings</h2>
              <button onClick={() => setShowWithdraw(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl mb-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Available balance: <strong>{formatCurrency(profile?.pendingBalance ?? 0)}</strong>.
                  Minimum withdrawal: <strong>{formatCurrency(tiers?.minimumWithdrawal ?? 5000)}</strong>.
                  Admin processes within 1–2 business days.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Amount (₦) <span className="text-destructive">*</span></Label>
                <Input
                  className="mt-1"
                  type="number"
                  placeholder={`Min. ₦${(tiers?.minimumWithdrawal ?? 5000).toLocaleString()}`}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Bank Details</p>
                <div className="space-y-3">
                  <div>
                    <Label>Bank Name <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" placeholder="e.g. GTBank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Account Number <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" placeholder="10-digit number" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <div>
                    <Label>Account Name <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" placeholder="Name on account" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                  </div>
                </div>
              </div>

              <Button onClick={handleWithdraw} disabled={isWithdrawing} className="w-full gap-2">
                {isWithdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Submit Withdrawal Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
