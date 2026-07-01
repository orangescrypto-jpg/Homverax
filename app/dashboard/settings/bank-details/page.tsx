"use client";

import { useEffect, useState } from "react";
import { Building2, CreditCard, Loader2, Save, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getBankDetails, saveBankDetails } from "@/services/wallet";
import type { UserBankDetails } from "@/services/wallet";
import { toast } from "sonner";

const NIGERIAN_BANKS = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank",
  "First Bank of Nigeria", "First City Monument Bank (FCMB)", "Guaranty Trust Bank (GTB)",
  "Heritage Bank", "Keystone Bank", "Opay", "PalmPay", "Polaris Bank",
  "Providus Bank", "Stanbic IBTC Bank", "Standard Chartered Bank",
  "Sterling Bank", "SunTrust Bank", "Titan Trust Bank", "Union Bank of Nigeria",
  "United Bank for Africa (UBA)", "Unity Bank", "Wema Bank", "Zenith Bank",
  "Kuda Bank", "Moniepoint", "VFD Microfinance Bank",
].sort();

export default function BankDetailsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<UserBankDetails>({
    bankName: "",
    accountNumber: "",
    accountName: "",
    bankCode: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    getBankDetails(user.id).then((details) => {
      if (details) setForm(details);
      setIsLoading(false);
    });
  }, [user]);

  const handleChange = (field: keyof UserBankDetails, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.bankName || !form.accountNumber || !form.accountName) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.accountNumber.length !== 10) {
      toast.error("Account number must be 10 digits");
      return;
    }
    setIsSaving(true);
    try {
      await saveBankDetails(user.id, form);
      setSaved(true);
      toast.success("Bank details saved successfully");
    } catch {
      toast.error("Failed to save bank details");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-foreground">Bank Details</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your bank details are used for wallet payouts and referral withdrawals.
            Admin sees these details when processing your payment.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Payment Account</p>
                <p className="text-xs text-muted-foreground">
                  Nigerian bank account for receiving payments
                </p>
              </div>
            </div>

            {/* Bank Name */}
            <div>
              <Label>
                Bank Name <span className="text-destructive">*</span>
              </Label>
              <select
                value={form.bankName}
                onChange={(e) => handleChange("bankName", e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select your bank</option>
                {NIGERIAN_BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Account Number */}
            <div>
              <Label>
                Account Number <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                placeholder="10-digit account number"
                maxLength={10}
                value={form.accountNumber}
                onChange={(e) => handleChange("accountNumber", e.target.value.replace(/\D/g, ""))}
              />
              {form.accountNumber.length > 0 && form.accountNumber.length !== 10 && (
                <p className="text-xs text-destructive mt-1">
                  Account number must be exactly 10 digits
                </p>
              )}
            </div>

            {/* Account Name */}
            <div>
              <Label>
                Account Name <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                placeholder="Name on the account"
                value={form.accountName}
                onChange={(e) => handleChange("accountName", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must match the name on your bank account exactly
              </p>
            </div>

            {/* Security note */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Your bank details are stored securely and only shared with HomveraX admin
                  when processing your payout or withdrawal request.
                </p>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full gap-2"
            >
              {isSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <Save className="w-4 h-4" />
              }
              {saved ? "Saved!" : "Save Bank Details"}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
