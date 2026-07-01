import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageContentRenderer from "@/components/PageContentRenderer";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "HomveraX Cookie Policy — how we use cookies and similar technologies.",
};

const DEFAULT_HTML = `<div class="space-y-8 text-muted-foreground leading-relaxed">
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">What Are Cookies</h2>
  <p>Cookies are small text files stored on your device when you visit a website. They help us remember your preferences and understand how you use HomveraX.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">Cookies We Use</h2>
  <p><strong>Essential:</strong> Required for authentication and core functionality (Firebase Auth session cookie).<br/><strong>Analytics:</strong> Firebase Analytics to understand usage patterns. No personally identifiable information is shared with advertisers.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">Managing Cookies</h2>
  <p>You can disable cookies in your browser settings. Disabling essential cookies will prevent you from logging in to HomveraX.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">Third Parties</h2>
  <p>We use Google Firebase (analytics and auth). Google may set additional cookies — see <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Google's Privacy Policy</a> for details.</p></div>
  <div><h2 class="text-lg font-serif font-semibold text-foreground mb-2">Contact</h2>
  <p>Cookie questions: privacy@homverax.com</p></div>
</div>`;

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: January 1, 2025</p>
        <PageContentRenderer slug="cookies" defaultHtml={DEFAULT_HTML} />
      </div>
      <Footer />
    </div>
  );
}
