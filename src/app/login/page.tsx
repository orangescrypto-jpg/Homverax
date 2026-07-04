import type { Metadata } from "next";
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your HomveraX account to manage listings, escrow, and more.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  // Suspense boundary required: LoginClient reads the ?next= redirect
  // param via useSearchParams(), which Next.js requires to be wrapped.
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
