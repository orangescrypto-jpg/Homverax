import type { Metadata } from "next";
import { Suspense } from "react";
import RegisterClient from "./RegisterClient";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Join HomveraX — Nigeria's most trusted property marketplace. Create your free account today.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  // Suspense boundary required: RegisterClient reads ?next= (and a
  // referral code) via useSearchParams(), which Next.js requires wrapped.
  return (
    <Suspense fallback={null}>
      <RegisterClient />
    </Suspense>
  );
}
