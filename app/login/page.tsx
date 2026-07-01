import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your HomveraX account to manage listings, escrow, and more.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginClient />;
}
