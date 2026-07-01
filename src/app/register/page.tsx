import type { Metadata } from "next";
import RegisterClient from "./RegisterClient";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Join HomveraX — Nigeria's most trusted property marketplace. Create your free account today.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <RegisterClient />;
}
