"use client";

/**
 * app/verify-email/page.tsx
 *
 * After registration (email or Google), users land here.
 * They must verify their email before continuing to select-role.
 *
 * - Polls Firebase every 4s for email verification status
 * - Allows resend (rate limited to once every 60s)
 * - Once verified, proceeds to /select-role automatically
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCurrentUserEmail,
  reloadAndCheckVerified,
  sendVerificationEmail,
  logoutUser,
} from "@/services/auth";
import { toast } from "sonner";
import Link from "next/link";

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyEmailPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  const userEmail = getCurrentUserEmail();

  // ── Poll Firebase every 4s to check if email has been verified ───────────
  useEffect(() => {
    if (verified) return;
    const interval = setInterval(async () => {
      try {
        const isVerified = await reloadAndCheckVerified();
        if (isVerified) {
          setVerified(true);
          clearInterval(interval);
          toast.success("Email verified! Setting up your account…");
          setTimeout(() => router.push("/select-role"), 1500);
        }
      } catch {
        // ignore transient errors
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [verified, router]);

  // ── Countdown timer for resend cooldown ───────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // ── Manual check button ───────────────────────────────────────────────────
  const handleCheck = async () => {
    setChecking(true);
    try {
      const isVerified = await reloadAndCheckVerified();
      if (isVerified) {
        setVerified(true);
        toast.success("Email verified!");
        router.push("/select-role");
      } else {
        toast.info("Not verified yet — check your inbox and spam folder.");
      }
    } catch {
      toast.error("Could not check verification status");
    } finally {
      setChecking(false);
    }
  };

  // ── Resend verification email ─────────────────────────────────────────────
  const handleResend = async () => {
    setSending(true);
    try {
      await sendVerificationEmail();
      toast.success("Verification email sent!");
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      if (err?.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please wait a few minutes.");
        setResendCooldown(RESEND_COOLDOWN);
      } else {
        toast.error("Failed to send email. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  // ── Sign out and go back ──────────────────────────────────────────────────
  const handleCancel = async () => {
    await logoutUser();
    router.push("/register");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">

        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-serif font-semibold text-foreground">
            Homvera<span className="text-accent font-bold">X</span>
          </span>
        </Link>

        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all ${
          verified ? "bg-green-100" : "bg-primary/10"
        }`}>
          {verified ? (
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          ) : (
            <Mail className="w-10 h-10 text-primary" />
          )}
        </div>

        {verified ? (
          <>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Email verified!</h1>
            <p className="text-muted-foreground mb-6">Redirecting you to complete your setup…</p>
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-muted-foreground mb-1">
              We sent a verification link to:
            </p>
            <p className="font-semibold text-foreground mb-6 break-all">{userEmail}</p>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 text-left space-y-2">
              <p className="text-sm font-semibold text-foreground">What to do:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Open the email from HomveraX</li>
                <li>Click the "Verify email" link</li>
                <li>Come back to this page — it updates automatically</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                Can't find it? Check your spam or promotions folder.
              </p>
            </div>

            {/* Pulsing "checking" indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Checking automatically every few seconds…
            </div>

            <div className="space-y-3">
              <Button onClick={handleCheck} disabled={checking} className="w-full gap-2">
                {checking
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</>
                  : <><RefreshCw className="w-4 h-4" /> I've verified — continue</>
                }
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleResend}
                disabled={sending || resendCooldown > 0}
              >
                {sending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : <><Mail className="w-4 h-4" /> Resend verification email</>
                }
              </Button>

              <button
                onClick={handleCancel}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Use a different email — back to register
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
