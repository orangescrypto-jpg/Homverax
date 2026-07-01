"use client";

import { useEffect, useState } from "react";
import {
  Bell, Building2, Eye, EyeOff, Globe, Loader2,
  Lock, Moon, Save, Shield, Sun, Trash2, Monitor,
  AlertTriangle, Smartphone, MessageCircle, Heart,
  Search, MapPin, CreditCard,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/hooks/useTheme";
import { usePushNotifications } from "@/hooks/usePushNotifications";
// ✅ FIX: All user writes go through service layer — no direct `db` import
import {
  updateUserBankDetails,
  updateUserNotifPrefs,
  updateUserPrivacyPrefs,
  changePassword,
} from "@/services/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Notification preferences
interface NotifPrefs {
  [key: string]: boolean;
  escrowUpdates: boolean;
  newMessages: boolean;
  offerReceived: boolean;
  inspectionReminders: boolean;
  promotions: boolean;
  searchAlerts: boolean;
  payoutUpdates: boolean;
  securityAlerts: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
}

// Privacy preferences
interface PrivacyPrefs {
  [key: string]: boolean;
  showPhoneToPublic: boolean;
  showEmailToPublic: boolean;
  showProfileToUnregistered: boolean;
  allowMessagesFromAll: boolean;
  showOnlineStatus: boolean;
  showRecentActivity: boolean;
}

const DEFAULT_NOTIF: NotifPrefs = {
  escrowUpdates: true,
  newMessages: true,
  offerReceived: true,
  inspectionReminders: true,
  promotions: false,
  searchAlerts: true,
  payoutUpdates: true,
  securityAlerts: true,
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
};

const DEFAULT_PRIVACY: PrivacyPrefs = {
  showPhoneToPublic: false,
  showEmailToPublic: false,
  showProfileToUnregistered: true,
  allowMessagesFromAll: false,
  showOnlineStatus: true,
  showRecentActivity: false,
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { logout } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Bank details state
  const [bankName, setBankName] = useState<string>(user?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState<string>(user?.accountNumber ?? "");
  const [accountName, setAccountName] = useState<string>(user?.accountName ?? "");
  const [savingBank, setSavingBank] = useState(false);

  // Notification preferences
  const [notif, setNotif] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [privacy, setPrivacy] = useState<PrivacyPrefs>(DEFAULT_PRIVACY);
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Push notifications
  const { permission, isSupported, requestPermission } = usePushNotifications();

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (!user) return;
    setBankName(user.bankName ?? "");
    setAccountNumber(user.accountNumber ?? "");
    setAccountName(user.accountName ?? "");
    if ((user as any).notifPrefs) setNotif({ ...DEFAULT_NOTIF, ...(user as any).notifPrefs });
    if ((user as any).privacyPrefs) setPrivacy({ ...DEFAULT_PRIVACY, ...(user as any).privacyPrefs });
  }, [user]);

  // ✅ FIX: Uses updateUserBankDetails service
  const saveBankDetails = async () => {
    if (!user) return;
    if (!bankName.trim()) { toast.error("Enter your bank name"); return; }
    if (!accountNumber.trim()) { toast.error("Enter your account number"); return; }
    if (!accountName.trim()) { toast.error("Enter your account name"); return; }
    setSavingBank(true);
    try {
      await updateUserBankDetails(user.id, bankName, accountNumber, accountName);
      toast.success("Bank details saved");
    } catch { toast.error("Failed to save bank details"); }
    finally { setSavingBank(false); }
  };

  // ✅ FIX: Uses updateUserNotifPrefs service
  const saveNotifPrefs = async () => {
    if (!user) return;
    setIsSavingNotif(true);
    try {
      await updateUserNotifPrefs(user.id, notif);
      toast.success("Notification preferences saved");
    } catch { toast.error("Failed to save"); }
    finally { setIsSavingNotif(false); }
  };

  // ✅ FIX: Uses updateUserPrivacyPrefs service
  const savePrivacyPrefs = async () => {
    if (!user) return;
    setIsSavingPrivacy(true);
    try {
      await updateUserPrivacyPrefs(user.id, privacy);
      toast.success("Privacy settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setIsSavingPrivacy(false); }
  };

  const handlePasswordChange = async () => {
    if (!user) return;
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setIsChangingPw(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.code === "auth/wrong-password" ? "Current password is incorrect" : "Failed to change password");
    } finally { setIsChangingPw(false); }
  };

  const toggleNotif = (key: keyof NotifPrefs) => setNotif((p) => ({ ...p, [key]: !p[key] }));
  const togglePrivacy = (key: keyof PrivacyPrefs) => setPrivacy((p) => ({ ...p, [key]: !p[key] }));

  function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
    return (
      <button onClick={onChange}
        className={cn("w-10 h-5.5 rounded-full transition-all relative shrink-0",
          enabled ? "bg-primary" : "bg-secondary border border-border"
        )}>
        <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
          enabled ? "left-[22px]" : "left-0.5"
        )} />
      </button>
    );
  }

  function SettingRow({ label, desc, enabled, onChange }: { label: string; desc?: string; enabled: boolean; onChange: () => void }) {
    return (
      <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        <Toggle enabled={enabled} onChange={onChange} />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your preferences, privacy, and account security.</p>
        </div>

        {/* ── Appearance ─────────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sun className="w-4 h-4 text-primary" /> Appearance
          </h2>
          <div className="flex gap-3">
            {[
              { value: "light", icon: Sun, label: "Light" },
              { value: "dark", icon: Moon, label: "Dark" },
              { value: "system", icon: Monitor, label: "System" },
            ].map(({ value, icon: Icon, label }) => (
              <button key={value} onClick={() => setTheme(value as any)}
                className={cn("flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all",
                  theme === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                )}>
                <Icon className={cn("w-5 h-5", theme === value ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-xs font-medium", theme === value ? "text-primary" : "text-muted-foreground")}>{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Notifications ──────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Notification Preferences
          </h2>

          {isSupported && permission !== "granted" && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Enable Push Notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get real-time alerts on your device</p>
              </div>
              <Button size="sm" onClick={requestPermission} className="gap-1 shrink-0">
                <Smartphone className="w-3 h-3" /> Enable
              </Button>
            </div>
          )}

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Channels</p>
          <SettingRow label="Email Notifications" desc="Receive updates by email" enabled={notif.emailNotifications} onChange={() => toggleNotif("emailNotifications")} />
          <SettingRow label="Push Notifications" desc="Alerts on your device" enabled={notif.pushNotifications} onChange={() => toggleNotif("pushNotifications")} />
          <SettingRow label="SMS Notifications" desc="Text message alerts (charges may apply)" enabled={notif.smsNotifications} onChange={() => toggleNotif("smsNotifications")} />

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">What to Notify</p>
          <SettingRow label="Escrow Updates" desc="Funding, releases, disputes" enabled={notif.escrowUpdates} onChange={() => toggleNotif("escrowUpdates")} />
          <SettingRow label="New Messages" enabled={notif.newMessages} onChange={() => toggleNotif("newMessages")} />
          <SettingRow label="Offer Received" desc="When someone makes an offer on your listing" enabled={notif.offerReceived} onChange={() => toggleNotif("offerReceived")} />
          <SettingRow label="Inspection Reminders" enabled={notif.inspectionReminders} onChange={() => toggleNotif("inspectionReminders")} />
          <SettingRow label="Search Alerts" desc="New listings matching your saved searches" enabled={notif.searchAlerts} onChange={() => toggleNotif("searchAlerts")} />
          <SettingRow label="Payout Updates" desc="Wallet credits and payout status" enabled={notif.payoutUpdates} onChange={() => toggleNotif("payoutUpdates")} />
          <SettingRow label="Security Alerts" desc="Login from new device, password changes" enabled={notif.securityAlerts} onChange={() => toggleNotif("securityAlerts")} />
          <SettingRow label="Promotions & News" desc="Platform updates and offers" enabled={notif.promotions} onChange={() => toggleNotif("promotions")} />

          <Button onClick={saveNotifPrefs} disabled={isSavingNotif} className="w-full mt-4 gap-2">
            {isSavingNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Notification Preferences
          </Button>
        </section>

        {/* ── Privacy ────────────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" /> Privacy Settings
          </h2>
          <SettingRow label="Show Phone Number Publicly" desc="Visible on your listings and profile" enabled={privacy.showPhoneToPublic} onChange={() => togglePrivacy("showPhoneToPublic")} />
          <SettingRow label="Show Email Publicly" enabled={privacy.showEmailToPublic} onChange={() => togglePrivacy("showEmailToPublic")} />
          <SettingRow label="Show Profile to Non-members" desc="Unregistered visitors can see your profile" enabled={privacy.showProfileToUnregistered} onChange={() => togglePrivacy("showProfileToUnregistered")} />
          <SettingRow label="Allow Messages from Anyone" desc="Off = only from people you've transacted with" enabled={privacy.allowMessagesFromAll} onChange={() => togglePrivacy("allowMessagesFromAll")} />
          <SettingRow label="Show Online Status" enabled={privacy.showOnlineStatus} onChange={() => togglePrivacy("showOnlineStatus")} />
          <SettingRow label="Show Recent Activity" desc="Others can see your recently viewed listings" enabled={privacy.showRecentActivity} onChange={() => togglePrivacy("showRecentActivity")} />

          <Button onClick={savePrivacyPrefs} disabled={isSavingPrivacy} className="w-full mt-4 gap-2">
            {isSavingPrivacy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Privacy Settings
          </Button>
        </section>

        {/* ── Bank Details ────────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-5">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Bank Account Details
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Used to receive payments when escrow deals are released to you.</p>
          <div className="space-y-3">
            <div>
              <Label>Bank Name</Label>
              <Input className="mt-1" placeholder="e.g. First Bank, GTBank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input className="mt-1" placeholder="10-digit account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={10} />
            </div>
            <div>
              <Label>Account Name</Label>
              <Input className="mt-1" placeholder="Name on account" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            <Button onClick={saveBankDetails} disabled={savingBank} className="gap-2">
              {savingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingBank ? "Saving…" : "Save Bank Details"}
            </Button>
          </div>
        </section>

        {/* ── Password ────────────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Change Password
          </h2>
          <div className="space-y-3">
            <div>
              <Label>Current Password</Label>
              <div className="relative mt-1">
                <Input type={showCurrentPw ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showCurrentPw ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <div>
              <Label>New Password</Label>
              <div className="relative mt-1">
                <Input type={showNewPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showNewPw ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input type="password" className="mt-1" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={handlePasswordChange} disabled={isChangingPw || !currentPassword || !newPassword} className="gap-2">
              {isChangingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {isChangingPw ? "Changing…" : "Change Password"}
            </Button>
          </div>
        </section>

        {/* ── Danger Zone ─────────────────────────────────────────────── */}
        <section className="bg-card border-2 border-red-200 dark:border-red-800/40 rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Danger Zone
          </h2>
          <p className="text-xs text-muted-foreground mb-4">These actions are permanent and cannot be undone.</p>

          {!showDeleteConfirm ? (
            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 gap-2"
              onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4" /> Delete My Account
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                Type <strong>DELETE</strong> to confirm account deletion. All your data, listings, and wallet balance will be permanently removed.
              </p>
              <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm" className="border-red-300" />
              <div className="flex gap-2">
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 gap-2"
                  disabled={deleteConfirmText !== "DELETE"}
                  onClick={() => toast.error("Account deletion requires admin approval. Contact support.")}>
                  <Trash2 className="w-4 h-4" /> Confirm Delete
                </Button>
                <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
