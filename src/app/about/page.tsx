import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Building2, CheckCircle2, Shield, Users } from "lucide-react";
import PageContentRenderer from "@/components/PageContentRenderer";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about HomveraX — our mission to make buying, selling, and hiring in Nigeria safe, transparent, and accessible through technology and escrow-protected payments.",
};

const DEFAULT_HTML = `<div class="space-y-8">
  <div class="bg-card border border-border rounded-2xl p-8">
    <h2 class="text-2xl font-serif font-bold text-foreground mb-4">Our Story</h2>
    <p class="text-muted-foreground leading-relaxed">HomveraX was born out of frustration with the Nigerian marketplace. Too many people had lost money to fraudulent agents, fake listings, unscrupulous sellers, and artisans who disappeared after being paid upfront. We built HomveraX to change that — a marketplace where every agent, seller, and service provider is identity-verified, every payment is escrow-protected, and every transaction is transparent.</p>
    <p class="text-muted-foreground leading-relaxed mt-4">We merged the best of two proven platforms — Homvera's elegant property search experience and Tetherng's powerful escrow and agent tools — into one comprehensive marketplace: HomveraX, covering property, home products, and everyday services.</p>
  </div>
  <div class="bg-card border border-border rounded-2xl p-8">
    <h2 class="text-2xl font-serif font-bold text-foreground mb-4">Contact Us</h2>
    <p class="text-muted-foreground">Email: <a href="mailto:hello@homverax.com" class="text-primary hover:underline">hello@homverax.com</a><br/>We're available Monday – Friday, 9am – 6pm WAT.</p>
  </div>
</div>`;

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-foreground mb-4">About HomveraX</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We're on a mission to eliminate fraud in Nigerian property, product, and service
            transactions through technology, verification, and trust.
          </p>
        </div>

        {/* Static value-prop cards — always shown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {[
            { icon: Shield,       title: "Safe Payments",   desc: "Escrow-protected transactions. Your money is held safely until you're satisfied." },
            { icon: CheckCircle2, title: "Verified Agents", desc: "Every agent goes through BVN and NIN verification before they can list." },
            { icon: Users,        title: "Community First", desc: "We serve tenants, agents, and landlords with equal respect and fair tools." },
          ].map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.title} className="bg-card border border-border rounded-2xl p-6 text-center">
                <Icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Admin-editable content */}
        <PageContentRenderer slug="about" defaultHtml={DEFAULT_HTML} />
      </div>
      <Footer />
    </div>
  );
}
