"use client";

import { useState } from "react";
import {
  AlertTriangle, Building2, Camera, CheckCircle2,
  Home, Loader2, Save, ShieldCheck, User, Wrench,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateUserProfile, updateUserRole } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { ROLE_CONFIG, SELECTABLE_ROLES, isAdminOrModerator } from "@/lib/roles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const ICON_MAP: Record<string, React.ElementType> = {
  User, Building2, Home, Wrench, ShieldCheck,
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { updateUser } = useAuthStore();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Role switch state
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUserProfile(user.id, {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        phone,
      });
      updateUser({ firstName, lastName, name: `${firstName} ${lastName}`, phone });
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    if (role === user?.role) return;
    setPendingRole(role);
    setShowRoleConfirm(true);
  };

  const handleRoleConfirm = async () => {
    if (!pendingRole || !user) return;
    setIsSwitchingRole(true);
    try {
      await updateUserRole(user.id, pendingRole);
      updateUser({ role: pendingRole });
      toast.success(`Switched to ${ROLE_CONFIG[pendingRole].label}!`);
      setShowRoleConfirm(false);
      setPendingRole(null);
    } catch {
      toast.error("Failed to switch role. Please try again.");
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const currentRoleCfg = user?.role ? ROLE_CONFIG[user.role] : null;

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-foreground">Profile & Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your personal information, role, and preferences.
          </p>
        </div>

        {/* Avatar */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-5">
          <h3 className="font-semibold text-foreground mb-4">Profile Photo</h3>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20 border-4 border-border">
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors">
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <p className="font-medium text-foreground">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {currentRoleCfg && (
                <span className={cn(
                  "inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded mt-1",
                  currentRoleCfg.bgColor, currentRoleCfg.color
                )}>
                  {currentRoleCfg.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-5">
          <h3 className="font-semibold text-foreground mb-4">Personal Information</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First name</Label>
                <Input className="mt-1.5" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input className="mt-1.5" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input className="mt-1.5" value={user?.email ?? ""} disabled readOnly />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here.</p>
            </div>
            <div>
              <Label>Phone number</Label>
              <Input
                className="mt-1.5"
                type="tel"
                placeholder="+234 800 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </div>

        {/* ─── Role Switcher ──────────────────────────────── */}
        <div id="role" className="bg-card border border-border rounded-2xl p-6 mb-5">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground">Account Role</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdminOrModerator(user?.role ?? "tenant")
                ? "Your role is assigned by the platform administrator and cannot be self-changed."
                : "Switch your role anytime. Your listings and escrow history are always preserved."}
            </p>
          </div>

          {isAdminOrModerator(user?.role ?? "tenant") ? (
            /* Staff: show read-only role card */
            <div className={cn(
              "flex items-center gap-4 p-4 rounded-xl border-2 border-primary bg-primary/5"
            )}>
              {currentRoleCfg && (() => {
                const ICON_MAP_LOCAL: Record<string, React.ElementType> = {
                  User, Building2, Home, Wrench, ShieldCheck,
                };
                const Icon = ICON_MAP_LOCAL[currentRoleCfg.iconName] ?? ShieldCheck;
                return (
                  <>
                    <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center shrink-0", currentRoleCfg.bgColor, currentRoleCfg.color, currentRoleCfg.borderColor)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{currentRoleCfg.label}</p>
                      <p className="text-xs text-muted-foreground">{currentRoleCfg.description}</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  </>
                );
              })()}
            </div>
          ) : (
            /* Non-staff: show switchable role grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SELECTABLE_ROLES.map((role) => {
              const cfg = ROLE_CONFIG[role];
              const Icon = ICON_MAP[cfg.iconName] ?? User;
              const isCurrent = user?.role === role;
              return (
                <button
                  key={role}
                  onClick={() => handleRoleSelect(role)}
                  disabled={isCurrent}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                    isCurrent
                      ? "border-primary bg-primary/5 cursor-default"
                      : "border-border hover:border-primary/40 hover:bg-secondary/50 cursor-pointer"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg border flex items-center justify-center shrink-0",
                    cfg.bgColor, cfg.color, cfg.borderColor
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{cfg.description}</p>
                  </div>
                  {isCurrent && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          )}

          {/* Confirm role switch dialog */}
          {showRoleConfirm && pendingRole && (
            <div className="mt-5 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                    Switch to {ROLE_CONFIG[pendingRole].label}?
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300/80 mt-1">
                    Your dashboard and navigation will update immediately to match your new role.
                    All your existing data — listings, escrow, saved properties — will be preserved.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleRoleConfirm}
                  disabled={isSwitchingRole}
                >
                  {isSwitchingRole
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : `Yes, switch to ${ROLE_CONFIG[pendingRole].shortLabel}`
                  }
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowRoleConfirm(false); setPendingRole(null); }}
                  disabled={isSwitchingRole}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Account status */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Account Status</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current role</span>
              {currentRoleCfg && (
                <span className={cn("font-semibold text-xs px-2 py-0.5 rounded", currentRoleCfg.bgColor, currentRoleCfg.color)}>
                  {currentRoleCfg.label}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subscription</span>
              <span className="font-medium text-foreground capitalize">{user?.subscriptionPlan ?? "Free"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Verification</span>
              <span className={cn("font-medium capitalize",
                user?.verificationStatus === "approved" ? "text-green-600" :
                user?.verificationStatus === "pending" ? "text-yellow-600" :
                "text-muted-foreground"
              )}>
                {user?.verificationStatus ?? "None"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
