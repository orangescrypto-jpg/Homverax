"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Eye, EyeOff, Loader2, CheckCircle2, Gift } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerWithEmail, loginWithGoogle } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";
import {
  findReferrerByCode,
  recordReferralLink,
  creditSignupBonus,
  creditWelcomeBonus,
  getOrCreateReferralProfile,
} from "@/services/referral";
import { getPlatformConfig } from "@/services/platformSettings";
import { toast } from "sonner";

const schema = z.object({
  firstName: z.string().min(2, "Enter your first name"),
  lastName: z.string().min(2, "Enter your last name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  terms: z.boolean().refine((v) => v, "You must accept the terms"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
type FormData = z.infer<typeof schema>;

const BENEFITS = [
  "Access 12,000+ verified listings",
  "Escrow-protected payments",
  "Verified agent badges",
  "Free for tenants & buyers",
];

export default function RegisterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [referralWelcomeBonus, setReferralWelcomeBonus] = useState(0);

  const {
    register, handleSubmit, formState: { errors, isSubmitting }, watch,
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { terms: false } });

  const password = watch("password", "");
  const passwordStrength =
    password.length === 0 ? 0
    : password.length < 8 ? 1
    : /[A-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 10 ? 3
    : 2;

  const strengthLabel = ["", "Weak", "Good", "Strong"][passwordStrength];
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-green-500"][passwordStrength];

  // ── Capture ?ref= code on mount ──────────────────────────────────────────────
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;

    setReferralCode(ref.toUpperCase());

    // Validate the code and get welcome bonus amount
    Promise.all([
      findReferrerByCode(ref),
      getPlatformConfig(),
    ]).then(([id, cfg]) => {
      if (id) {
        setReferrerId(id);
        if (cfg.referralTiers.welcomeBonusEnabled && cfg.referralTiers.welcomeBonusTrigger === "signup") {
          setReferralWelcomeBonus(cfg.referralTiers.welcomeBonusAmount);
        }
      }
    }).catch(() => {
      // Invalid code — silent fail, still allow registration
    });
  }, [searchParams]);

  // ── Process referral after successful registration ────────────────────────────
  async function processReferral(newUserId: string, newUserName: string) {
    if (!referrerId || !referralCode) return;

    try {
      // Ensure referrer has a profile
      await getOrCreateReferralProfile(referrerId, "");

      // Record the link
      await recordReferralLink(referrerId, newUserId, newUserName, "tenant", referralCode);

      // Credit signup bonus to referrer
      await creditSignupBonus(referrerId, newUserId, newUserName);

      // Credit welcome bonus to new user if trigger is signup
      const cfg = await getPlatformConfig();
      if (
        cfg.referralTiers.welcomeBonusEnabled &&
        cfg.referralTiers.welcomeBonusTrigger === "signup"
      ) {
        await creditWelcomeBonus(newUserId, newUserName);
      }
    } catch (err) {
      // Non-critical — don't block registration
      console.warn("Referral processing failed:", err);
    }
  }

  const onSubmit = async (data: FormData) => {
    try {
      const name = `${data.firstName} ${data.lastName}`;
      const user = await registerWithEmail(data.email, data.password, name);
      setUser(user);

      // Process referral in background
      processReferral(user.id, user.name);

      if (referralWelcomeBonus > 0) {
        toast.success(`Account created! You've earned ₦${referralWelcomeBonus.toLocaleString()} welcome bonus 🎉`);
      } else {
        toast.success("Account created! Let's get you set up.");
      }
      router.push("/select-role");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("email-already-in-use")) {
        toast.error("An account with this email already exists");
      } else {
        toast.error("Registration failed. Please try again.");
      }
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      setUser(user);

      // Process referral in background
      processReferral(user.id, user.name);

      toast.success("Account created!");
      router.push(user.roleSelected ? "/dashboard" : "/select-role");
    } catch {
      toast.error("Google sign-in failed");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-[var(--sidebar)] flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
            <Building2 className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="text-xl font-serif font-semibold text-[var(--sidebar-foreground)]">
            Homvera<span className="text-accent font-bold">X</span>
          </span>
        </Link>

        <div>
          <h2 className="text-3xl font-serif font-bold text-[var(--sidebar-foreground)] leading-tight mb-4">
            Nigeria's most trusted property marketplace
          </h2>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-[var(--sidebar-foreground)]/80">
                <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[var(--sidebar-foreground)]/50">
          © {new Date().getFullYear()} HomveraX. All rights reserved.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-foreground">
              Homvera<span className="text-primary">X</span>
            </span>
          </Link>

          <h1 className="text-2xl font-serif font-bold text-foreground mb-1">Create your account</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Join thousands of Nigerians transacting safely.
          </p>

          {/* Referral banner */}
          {referralCode && referrerId && (
            <div className="mb-5 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
              <Gift className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">You were referred! 🎉</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {referralWelcomeBonus > 0
                    ? `You'll earn ₦${referralWelcomeBonus.toLocaleString()} welcome bonus after registration.`
                    : "Your friend invited you to HomveraX."}
                </p>
              </div>
            </div>
          )}

          {/* Google */}
          <Button
            variant="outline"
            className="w-full gap-2 mb-4 h-11"
            onClick={handleGoogle}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
            }
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input className="mt-1" placeholder="Emeka" {...register("firstName")} />
                {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <Label>Last Name</Label>
                <Input className="mt-1" placeholder="Okafor" {...register("lastName")} />
                {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <Label>Email Address</Label>
              <Input className="mt-1" type="email" placeholder="you@example.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label>Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${strengthColor}`}
                      style={{ width: `${(passwordStrength / 3) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{strengthLabel}</span>
                </div>
              )}
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <Label>Confirm Password</Label>
              <Input
                className="mt-1"
                type="password"
                placeholder="Repeat password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" id="terms" className="mt-1 rounded" {...register("terms")} />
              <label htmlFor="terms" className="text-xs text-muted-foreground">
                I agree to the{" "}
                <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </label>
            </div>
            {errors.terms && <p className="text-xs text-destructive">{errors.terms.message}</p>}

            <Button type="submit" className="w-full h-11 gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create Account
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
