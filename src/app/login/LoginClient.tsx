"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithEmail, loginWithGoogle, sendPasswordReset } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function LoginClient() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const user = await loginWithEmail(data.email, data.password);
      setUser(user);
      toast.success(`Welcome back, ${user.firstName || user.name}!`);
      router.push(user.roleSelected ? "/dashboard" : "/select-role");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        toast.error("Invalid email or password");
      } else {
        toast.error(msg);
      }
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      setUser(user);
      toast.success(`Welcome, ${user.firstName || user.name}!`);
      router.push(user.roleSelected ? "/dashboard" : "/select-role");
    } catch (err: unknown) {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) { toast.error("Enter your email first"); return; }
    try {
      await sendPasswordReset(forgotEmail);
      toast.success("Reset link sent — check your inbox");
      setShowForgot(false);
    } catch {
      toast.error("Failed to send reset email");
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
            <Building2 className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="text-xl font-serif font-semibold text-primary-foreground">
            Homvera<span className="text-accent font-bold">X</span>
          </span>
        </Link>
        <div>
          <h2 className="text-4xl font-serif font-bold text-primary-foreground leading-tight mb-4">
            Welcome back to Nigeria's safest property marketplace
          </h2>
          <p className="text-primary-foreground/70 text-lg">
            Manage your listings, track escrow payments, and connect with verified clients — all in one place.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { value: "12K+", label: "Active listings" },
            { value: "₦2.4B+", label: "Secured in escrow" },
            { value: "3.5K+", label: "Verified agents" },
            { value: "45K+", label: "Happy users" },
          ].map((s) => (
            <div key={s.label} className="bg-primary-foreground/10 rounded-xl p-4">
              <p className="text-2xl font-serif font-bold text-primary-foreground">{s.value}</p>
              <p className="text-sm text-primary-foreground/60 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-serif font-semibold text-foreground">
              Homvera<span className="text-accent font-bold">X</span>
            </span>
          </Link>

          {!showForgot ? (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Sign in</h1>
                <p className="text-muted-foreground">
                  Don't have an account?{" "}
                  <Link href="/register" className="text-primary font-medium hover:underline">
                    Create one free
                  </Link>
                </p>
              </div>

              {/* Google */}
              <Button
                variant="outline"
                className="w-full mb-4 gap-3 h-11"
                onClick={handleGoogle}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">or sign in with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="mt-1.5 h-11"
                    {...register("email")}
                  />
                  {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-11 pr-10"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
                </div>

                <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in…</> : "Sign in"}
                </Button>
              </form>
            </>
          ) : (
            <div>
              <button
                onClick={() => setShowForgot(false)}
                className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1"
              >
                ← Back to sign in
              </button>
              <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Reset password</h1>
              <p className="text-muted-foreground mb-6">Enter your email and we'll send a reset link.</p>
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="h-11"
                />
                <Button className="w-full h-11" onClick={handleForgotPassword}>
                  Send reset link
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
