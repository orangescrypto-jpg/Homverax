"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2, CheckCircle2, Home, Loader2,
  ShieldCheck, User, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateUserRole } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { ROLE_CONFIG, SELECTABLE_ROLES } from "@/lib/roles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const ICON_MAP: Record<string, React.ElementType> = {
  User, Building2, Home, Wrench, ShieldCheck,
};

function SelectRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Final destination after role setup — e.g. the agent profile the
  // visitor originally tried to view before being routed through
  // login/register/select-role. Falls back to the normal dashboard.
  const next = searchParams.get("next");
  const { user, isLoading: authLoading } = useAuth();
  const { updateUser } = useAuthStore();
  const [selected, setSelected] = useState<UserRole | null>(
    user?.roleSelected ? user.role : null
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;
    if (!user) {
      toast.error("Your session isn't ready yet — please wait a moment and try again.");
      return;
    }
    setIsLoading(true);
    try {
      await updateUserRole(user.id, selected);
      updateUser({ role: selected, roleSelected: true });
      toast.success("Great! Your account is all set.");
      router.push(next || "/dashboard");
    } catch (err) {
      console.error("[select-role] Failed to save role:", err);
      const msg = err instanceof Error ? err.message : "Failed to save your role. Please try again.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            How will you use HomveraX?
          </h1>
          <p className="text-muted-foreground">
            Choose the role that best describes you. You can switch anytime from your profile.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {SELECTABLE_ROLES.map((role) => {
            const cfg = ROLE_CONFIG[role];
            const Icon = ICON_MAP[cfg.iconName] ?? User;
            const isSelected = selected === role;
            return (
              <button
                key={role}
                onClick={() => setSelected(role)}
                className={cn(
                  "w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40 hover:bg-secondary/50"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl border flex items-center justify-center shrink-0",
                  cfg.bgColor, cfg.color, cfg.borderColor
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{cfg.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{cfg.description}</p>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        <Button
          className="w-full h-12 font-semibold text-base"
          disabled={!selected || isLoading || authLoading}
          onClick={handleContinue}
        >
          {authLoading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading your session…</>
            : isLoading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up…</>
            : "Continue to Dashboard"
          }
        </Button>
      </div>
    </div>
  );
}

export default function SelectRolePage() {
  // Suspense boundary required: this page reads the ?next= redirect param
  // via useSearchParams(), which Next.js requires to be wrapped.
  return (
    <Suspense fallback={null}>
      <SelectRoleContent />
    </Suspense>
  );
}
