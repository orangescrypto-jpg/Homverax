import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "HomveraX Terms of Service — read our terms before using the platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Last updated: January 1, 2025</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          {[
            {
              title: "1. Acceptance of Terms",
              content: "By accessing or using HomveraX ('the Platform'), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform. These terms apply to all visitors, users, agents, landlords, tenants, and service providers.",
            },
            {
              title: "2. Platform Services",
              content: "HomveraX provides a property and services marketplace for the Nigerian market, including property listings, agent verification, escrow payment protection, and messaging. We are a marketplace facilitator — we do not own any properties listed on the Platform.",
            },
            {
              title: "3. User Accounts",
              content: "You must register for an account to access most features. You are responsible for maintaining the security of your account credentials. You must provide accurate information during registration. Users must be 18 years or older to use the Platform.",
            },
            {
              title: "4. Listings and Content",
              content: "Agents and landlords are solely responsible for the accuracy of their listings. HomveraX reserves the right to remove any listing that violates our policies, is fraudulent, or is otherwise inappropriate. All content must be truthful and not misleading.",
            },
            {
              title: "5. Escrow Services",
              content: "HomveraX provides escrow services to protect buyers and sellers. Funds deposited into escrow are held in a dedicated account and are only released upon confirmation by both parties. A platform fee of 1.5% applies to all escrow transactions.",
            },
            {
              title: "6. Verification",
              content: "Agent and property verification is available for a fee. Verification is based on documents provided and does not constitute a guarantee. HomveraX is not liable for any misrepresentation by verified users beyond what was submitted for verification.",
            },
            {
              title: "7. Prohibited Activities",
              content: "Users must not: post fraudulent or misleading listings, use the platform for money laundering, circumvent payment protections, harass other users, or violate any applicable Nigerian laws or regulations.",
            },
            {
              title: "8. Limitation of Liability",
              content: "HomveraX is not liable for any direct, indirect, incidental, or consequential damages arising from use of the Platform. Our liability in any circumstance is limited to the escrow fees paid in the relevant transaction.",
            },
            {
              title: "9. Governing Law",
              content: "These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in Lagos State courts.",
            },
            {
              title: "10. Changes to Terms",
              content: "HomveraX reserves the right to update these terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated terms.",
            },
          ].map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-serif font-semibold text-foreground mb-2">{s.title}</h2>
              <p>{s.content}</p>
            </div>
          ))}

          <div className="pt-4 border-t border-border text-sm">
            <p>
              Questions? Email us at{" "}
              <a href="mailto:legal@homverax.com" className="text-primary hover:underline">legal@homverax.com</a>.
              Also see our{" "}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>{" "}
              and{" "}
              <Link href="/escrow-agreement" className="text-primary hover:underline">Escrow Agreement</Link>.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
