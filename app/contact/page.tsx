import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageContentRenderer from "@/components/PageContentRenderer";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the HomveraX team. We're here to help with listings, escrow, verification, and more.",
};

const DEFAULT_HTML = `<div class="space-y-6">
  <div class="bg-card border border-border rounded-2xl p-8">
    <h2 class="text-xl font-serif font-bold text-foreground mb-4">Email</h2>
    <p class="text-muted-foreground"><a href="mailto:hello@homverax.com" class="text-primary hover:underline">hello@homverax.com</a></p>
    <p class="text-sm text-muted-foreground mt-1">We reply within 24 hours, Monday – Friday 9am – 6pm WAT.</p>
  </div>
  <div class="bg-card border border-border rounded-2xl p-8">
    <h2 class="text-xl font-serif font-bold text-foreground mb-4">Office Location</h2>
    <p class="text-muted-foreground">Lagos & Abuja, Nigeria</p>
  </div>
  <div class="bg-card border border-border rounded-2xl p-8">
    <h2 class="text-xl font-serif font-bold text-foreground mb-4">Support Hours</h2>
    <p class="text-muted-foreground">Monday – Friday: 9am – 6pm WAT<br/>Saturday: 10am – 2pm WAT<br/>Sunday: Closed</p>
  </div>
</div>`;

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-foreground mb-3">Contact Us</h1>
          <p className="text-muted-foreground text-lg">
            We're here to help. Reach out any way that works for you.
          </p>
        </div>
        <PageContentRenderer slug="contact" defaultHtml={DEFAULT_HTML} />
      </div>
      <Footer />
    </div>
  );
}
