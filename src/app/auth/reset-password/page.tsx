/**
 * app/auth/reset-password/page.tsx
 * Supabase password reset landing page.
 * Supabase sends users here after clicking the reset link.
 */
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Reset Password | HomveraX" };

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <ResetPasswordForm />
    </main>
  );
}
