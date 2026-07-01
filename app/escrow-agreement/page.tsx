import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageContentRenderer from "@/components/PageContentRenderer";

export const metadata: Metadata = {
  title: "Escrow Agreement",
  description:
    "HomveraX Escrow Agreement — understand how your payments are held and released.",
};

const DEFAULT_HTML = `<div class="space-y-8 text-muted-foreground leading-relaxed">
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">1. What Is Escrow?</h2>
  <p>HomveraX acts as a neutral escrow agent, holding your payment securely until both parties confirm the transaction is complete or the inspection window closes. No funds are released until the process is satisfied.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">2. How It Works</h2>
  <p>Buyer sends payment → HomveraX holds funds securely → Inspection period begins → Buyer confirms receipt or raises a dispute → Funds released to seller or refunded to buyer based on outcome.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">3. Platform Fee</h2>
  <p>A platform service fee is deducted from the escrow amount at the time of release. The applicable fee percentage is displayed clearly before any payment is initiated.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">4. Inspection Period</h2>
  <p>After payment is confirmed, an inspection window opens during which the buyer may inspect the property or service. If no action is taken before the window closes, funds are automatically released to the seller.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">5. Disputes</h2>
  <p>Either party may raise a dispute within the inspection window. HomveraX will review evidence submitted by both parties and make a final determination within the dispute resolution window stated in our current settings. HomveraX's decision is final and binding.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">6. Prohibited Use</h2>
  <p>Escrow may not be used for any transaction that violates Nigerian law, including but not limited to fraud, money laundering, or transactions for prohibited goods and services.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">7. Contact</h2>
  <p>Escrow support: escrow@homverax.com</p></div>
</div>`;

export default function EscrowAgreementPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2">Escrow Agreement</h1>
        <p className="text-muted-foreground mb-10">Last updated: January 1, 2025</p>
        <PageContentRenderer slug="escrow-agreement" defaultHtml={DEFAULT_HTML} />
      </div>
      <Footer />
    </div>
  );
}
