"use client";

import { useEffect, useState } from "react";
import {
  BanknoteIcon, CheckCircle2, CreditCard, Gift,
  Loader2, Save, Settings, Share2, Shield, Megaphone,
  ToggleRight, MessageCircle, Clock, Mail, Phone,
  Star, Users, Wallet, AlertCircle, BarChart2, Tag, MessageSquare,
  Plus, Trash2, Quote, Send,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPlatformConfig, savePlatformConfig,
  DEFAULT_CONFIG, DEFAULT_FEATURES, DEFAULT_SOCIAL,
  DEFAULT_ESCROW_FEES, DEFAULT_INSPECTION_FEE,
  DEFAULT_FEATURED_AGENT, DEFAULT_SMS_CONFIG, DEFAULT_EMAIL_CONFIG,
  DEFAULT_REFERRAL_TIERS, DEFAULT_HOMEPAGE_CTA, DEFAULT_TESTIMONIALS,
  type PlatformConfig, type BankDetails, type FeatureFlags,
  type SocialLinks, type EscrowFeeConfig, type InspectionFeeConfig,
  type FeaturedAgentConfig, type SmsConfig, type EmailConfig,
  type ReferralTierConfig, type HomepageCTA, type Testimonial,
} from "@/services/platformSettings";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, subtitle, icon: Icon, children,
}: {
  title: string; subtitle: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-start gap-3 px-6 py-4 border-b border-border bg-secondary/30">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Feature toggle ───────────────────────────────────────────────────────────

function FeatureToggle({
  label, description, enabled, onChange,
}: {
  label: string; description: string; enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          "w-11 h-6 rounded-full transition-all relative shrink-0 mt-0.5",
          enabled ? "bg-primary" : "bg-secondary border border-border",
        )}
      >
        <span className={cn(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
          enabled ? "left-[22px]" : "left-0.5",
        )} />
      </button>
    </div>
  );
}

// ─── Number field ─────────────────────────────────────────────────────────────

function NumField({
  label, value, onChange, prefix, suffix, hint, step = "1",
}: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; hint?: string; step?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative mt-1">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
        )}
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(prefix && "pl-7", suffix && "pr-7")}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────

function SaveBtn({ label, saving }: { label: string; saving: string | null }) {
  const isThis = saving === label;
  return (
    <Button type="submit" disabled={!!saving} className="gap-2">
      {isThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {isThis ? "Saving…" : `Save ${label}`}
    </Button>
  );
}

// ─── Email Test Send ──────────────────────────────────────────────────────────

const EMAIL_TEST_TEMPLATES = [
  { value: "escrow_funded_buyer",     label: "Escrow Funded (buyer)" },
  { value: "escrow_funded_seller",    label: "Escrow Funded (seller)" },
  { value: "escrow_released_seller",  label: "Escrow Released (seller)" },
  { value: "escrow_released_buyer",   label: "Escrow Released (buyer)" },
  { value: "booking_confirmed_buyer", label: "Booking Confirmed (buyer)" },
  { value: "booking_confirmed_seller",label: "Booking Confirmed (seller)" },
  { value: "payout_approved",         label: "Payout Approved" },
  { value: "verification_approved",   label: "Verification Approved" },
  { value: "subscription_activated",  label: "Subscription Activated" },
] as const;

function EmailTestSend() {
  const [template, setTemplate] = useState<string>(EMAIL_TEST_TEMPLATES[0].value);
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);

  async function handleTestSend() {
    if (!recipient.trim()) {
      toast.error("Enter a recipient email address");
      return;
    }
    setSending(true);
    try {
      // Build representative sample data for the chosen template
      const sampleData: Record<string, unknown> = {
        buyerName: "Test Buyer", buyerEmail: recipient,
        sellerName: "Test Seller", sellerEmail: recipient,
        userName: "Test User", userEmail: recipient,
        listingTitle: "3 Bed Apartment, Lekki Phase 1",
        amount: 5000000, sellerReceives: 4750000, platformFee: 250000,
        escrowId: "test-escrow-001",
        bookingId: "test-booking-001",
        bankName: "GTBank", accountNumber: "012•••3456",
        verificationType: "Identity (NIN)",
        planName: "Pro", expiresAt: "30 July 2026",
      };
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, to: recipient.trim(), data: sampleData }),
      });
      const json = await res.json() as { ok?: boolean; skipped?: boolean; reason?: string };
      if (json.skipped) {
        toast.warning(`Email skipped — reason: ${json.reason ?? "provider disabled"}`);
      } else if (json.ok) {
        toast.success(`Test email sent to ${recipient.trim()}`);
      } else {
        toast.error("Send failed — check server logs");
      }
    } catch {
      toast.error("Network error sending test email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send Test Email</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Template</Label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="mt-1 w-full h-9 px-3 rounded-xl border border-border bg-background text-sm"
          >
            {EMAIL_TEST_TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Recipient Email</Label>
          <Input
            className="mt-1 h-9 text-sm"
            type="email"
            placeholder="you@example.com"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
      </div>
      <Button
        onClick={handleTestSend}
        disabled={sending}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? "Sending…" : "Send Test Email"}
      </Button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsClient() {
  const { user } = useAuth();
  const [config, setConfig]       = useState<PlatformConfig>(DEFAULT_CONFIG);
  const [features, setFeatures]   = useState<FeatureFlags>(DEFAULT_FEATURES);
  const [social, setSocial]       = useState<SocialLinks>(DEFAULT_SOCIAL);
  const [escrowFees, setEscrowFees]       = useState<EscrowFeeConfig>(DEFAULT_ESCROW_FEES);
  const [inspectionFee, setInspectionFee] = useState<InspectionFeeConfig>(DEFAULT_INSPECTION_FEE);
  const [featuredAgent, setFeaturedAgent] = useState<FeaturedAgentConfig>(DEFAULT_FEATURED_AGENT);
  const [sms, setSms]             = useState<SmsConfig>(DEFAULT_SMS_CONFIG);
  const [emailCfg, setEmailCfg]   = useState<EmailConfig>(DEFAULT_EMAIL_CONFIG);
  const [referralTiers, setReferralTiers] = useState<ReferralTierConfig>(DEFAULT_REFERRAL_TIERS);
  const [homepageCTA, setHomepageCTA] = useState<HomepageCTA>(DEFAULT_HOMEPAGE_CTA);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);

  useEffect(() => {
    getPlatformConfig().then((cfg) => {
      setConfig(cfg);
      setFeatures({ ...DEFAULT_FEATURES, ...cfg.features });
      setSocial({ ...DEFAULT_SOCIAL, ...(cfg.social ?? {}) });
      setEscrowFees({ ...DEFAULT_ESCROW_FEES, ...(cfg.escrowFees ?? {}) });
      setInspectionFee({ ...DEFAULT_INSPECTION_FEE, ...(cfg.inspectionFee ?? {}) });
      setFeaturedAgent({ ...DEFAULT_FEATURED_AGENT, ...(cfg.featuredAgent ?? {}) });
      setSms({ ...DEFAULT_SMS_CONFIG, ...(cfg.sms ?? {}) });
      setEmailCfg({ ...DEFAULT_EMAIL_CONFIG, ...(cfg.email ?? {}) });
      setReferralTiers({ ...DEFAULT_REFERRAL_TIERS, ...(cfg.referralTiers ?? {}) });
      setHomepageCTA(cfg.homepageCTA ? { ...DEFAULT_HOMEPAGE_CTA, ...cfg.homepageCTA } : DEFAULT_HOMEPAGE_CTA);
      setTestimonials(cfg.testimonials?.length ? cfg.testimonials : DEFAULT_TESTIMONIALS);
    }).finally(() => setIsLoading(false));
  }, []);

  const save = async (label: string, partial: Partial<PlatformConfig>) => {
    if (!user) return;
    setSaving(label);
    try {
      await savePlatformConfig(partial, user.id, user.name);
      setConfig((prev) => ({ ...prev, ...partial }));
      toast.success(`${label} saved`);
    } catch {
      toast.error(`Failed to save ${label}`);
    } finally {
      setSaving(null);
    }
  };

  const toggleFeature = async (key: keyof FeatureFlags) => {
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    setSaving("Features");
    try {
      if (!user) return;
      await savePlatformConfig({ features: updated }, user.id, user.name);
      toast.success("Feature saved");
    } catch {
      toast.error("Failed to save feature");
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-5">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Platform Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure all platform features, fees, and settings without code changes.
          {config.updatedBy && (
            <span className="ml-2 text-xs opacity-70">Last updated by {config.updatedBy}</span>
          )}
        </p>
      </div>

      <div className="space-y-6">

        {/* ── Feature Flags ──────────────────────────────────────────────── */}
        <Section title="Feature Flags" subtitle="Toggle features on/off without code changes" icon={ToggleRight}>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Listings</p>
            {[
              { key: "enableDuplicateDetection", label: "Duplicate Detection", desc: "Warn agents when a similar listing already exists" },
              { key: "enableAutoWatermark", label: "Auto Watermark", desc: "Add HomveraX watermark to all listing photos automatically" },
              { key: "enablePriceHistory", label: "Price History", desc: "Show price change history on listing pages" },
              { key: "enableListingAnalytics", label: "Listing Analytics", desc: "Show views, saves, and inquiry stats to sellers" },
              { key: "enableDocumentVerification", label: "Document Verification", desc: "Allow sellers to upload property documents" },
              { key: "enableVirtualTour", label: "Virtual Tours", desc: "Allow agents to add 360° virtual tour links" },
              { key: "enablePropertyComparison", label: "Property Comparison", desc: "Let buyers compare listings side by side" },
              { key: "enableBulkListingImport", label: "Bulk CSV Import", desc: "Allow agents to import multiple listings via CSV" },
            ].map(({ key, label, desc }) => (
              <FeatureToggle key={key} label={label} description={desc}
                enabled={features[key as keyof FeatureFlags] as boolean}
                onChange={() => toggleFeature(key as keyof FeatureFlags)} />
            ))}

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-5">Payments & Escrow</p>
            {[
              { key: "enableSellerWallet", label: "Seller Wallet", desc: "Track seller earnings and enable withdrawal requests" },
              { key: "enableInstallmentPayments", label: "Installment Payments", desc: "Allow buyers to pay in installments" },
              { key: "enableAutoReleaseEscrow", label: "Auto-Release Escrow", desc: "Automatically release escrow after inspection window" },
              { key: "enableAutoResolveDisputes", label: "Auto-Resolve Disputes", desc: "Auto-refund buyer if seller doesn't respond in time" },
              { key: "enableInspectionFee", label: "Inspection Fee", desc: "Charge buyers a fee to confirm inspection (set amount below)" },
            ].map(({ key, label, desc }) => (
              <FeatureToggle key={key} label={label} description={desc}
                enabled={features[key as keyof FeatureFlags] as boolean}
                onChange={() => toggleFeature(key as keyof FeatureFlags)} />
            ))}

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-5">User & Growth</p>
            {[
              { key: "enableReferralProgram", label: "Referral Program", desc: "Let users earn by referring others" },
              { key: "enableBVNVerification", label: "BVN Verification", desc: "Require BVN for agents" },
              { key: "enableOfferSystem", label: "Offer System", desc: "Let buyers make offers on listings" },
              { key: "enableInspectionBooking", label: "Inspection Booking", desc: "Let buyers schedule property inspections" },
              { key: "enableReviewsAndRatings", label: "Reviews & Ratings", desc: "Allow ratings after completed deals" },
              { key: "enableSavedSearchAlerts", label: "Saved Search Alerts", desc: "Notify users when new listings match their searches" },
              { key: "enableMortgageCalculator", label: "Mortgage Calculator", desc: "Show calculator on listing pages" },
              { key: "enableMarketTrends", label: "Market Trends Page", desc: "Show price trends by LGA" },
              { key: "enableAgentLeaderboard", label: "Agent Leaderboard", desc: "Public ranking of top agents" },
              { key: "enableFeaturedAgents", label: "Featured Agents", desc: "Paid agent slots on homepage (set price below)" },
            ].map(({ key, label, desc }) => (
              <FeatureToggle key={key} label={label} description={desc}
                enabled={features[key as keyof FeatureFlags] as boolean}
                onChange={() => toggleFeature(key as keyof FeatureFlags)} />
            ))}

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-5">Notifications</p>
            {[
              { key: "enableSmsNotifications", label: "SMS Notifications", desc: "Send SMS alerts via Termii or Africa's Talking (configure below)" },
              { key: "enableEmailNotifications", label: "Branded Email", desc: "Send branded HTML emails via Resend (configure below)" },
              { key: "enablePushNotifications", label: "Push Notifications", desc: "Browser/device push notifications" },
            ].map(({ key, label, desc }) => (
              <FeatureToggle key={key} label={label} description={desc}
                enabled={features[key as keyof FeatureFlags] as boolean}
                onChange={() => toggleFeature(key as keyof FeatureFlags)} />
            ))}

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-5">Platform</p>
            {[
              { key: "enableLiveChat", label: "WhatsApp Live Chat", desc: "Show WhatsApp chat button on all pages" },
              { key: "enableAiChatbot", label: "AI Chatbot Widget", desc: "Show HomveraX AI assistant bubble on all pages" },
              { key: "enablePWA", label: "PWA Install Banner", desc: "Show install prompt to mobile users" },
              { key: "enableBlogSection", label: "Blog Section", desc: "Show blog/articles section" },
              { key: "enableRentalsPage", label: "Rentals Page", desc: "Show /rentals link in navbar and homepage" },
              { key: "enableFlashDeals", label: "Flash Deals", desc: "Time-limited discount listings" },
              { key: "enableBadges", label: "Listing Badges", desc: "New, Hot, Verified badges on listings" },
              { key: "enableStockAlerts", label: "Stock Alerts", desc: "Alert admin of high-view but low-inquiry listings" },
              { key: "maintenanceMode", label: "⚠️ Maintenance Mode", desc: "Show maintenance page to all visitors" },
            ].map(({ key, label, desc }) => (
              <FeatureToggle key={key} label={label} description={desc}
                enabled={features[key as keyof FeatureFlags] as boolean}
                onChange={() => toggleFeature(key as keyof FeatureFlags)} />
            ))}
          </div>
        </Section>

        {/* ── Escrow Fee Model ───────────────────────────────────────────── */}
        <Section
          title="Escrow Fee Structure"
          subtitle="Buyer service charge + seller platform fee by listing type. Both read from here — no code changes."
          icon={Shield}
        >
          <div className="space-y-6">
            {/* Buyer side */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-500" />
                Buyer Pays (added on top of listing price at checkout)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="Service Charge (%)"
                  value={escrowFees.buyerServiceChargePercent}
                  onChange={(v) => setEscrowFees((f) => ({ ...f, buyerServiceChargePercent: v }))}
                  suffix="%" step="0.1"
                  hint="e.g. 1% on ₦1,000,000 = ₦10,000 buyer pays"
                />
                <div>
                  <Label>Label shown to buyer</Label>
                  <Input
                    className="mt-1"
                    value={escrowFees.buyerServiceChargeLabel}
                    placeholder="e.g. Service Charge"
                    onChange={(e) => setEscrowFees((f) => ({ ...f, buyerServiceChargeLabel: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Shown at checkout e.g. "Service Charge"</p>
                </div>
              </div>
            </div>

            {/* Seller side */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-green-500" />
                Seller Pays (deducted before payout — different per listing type)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="For Sale listings (%)"
                  value={escrowFees.sellerSaleFeePercent}
                  onChange={(v) => setEscrowFees((f) => ({ ...f, sellerSaleFeePercent: v }))}
                  suffix="%" step="0.1"
                  hint="Agent selling a property"
                />
                <NumField
                  label="For Rent listings (%)"
                  value={escrowFees.sellerRentalFeePercent}
                  onChange={(v) => setEscrowFees((f) => ({ ...f, sellerRentalFeePercent: v }))}
                  suffix="%" step="0.1"
                  hint="Agent or landlord renting out"
                />
                <NumField
                  label="For Shortlets (%)"
                  value={escrowFees.sellerShortletFeePercent}
                  onChange={(v) => setEscrowFees((f) => ({ ...f, sellerShortletFeePercent: v }))}
                  suffix="%" step="0.1"
                  hint="Short-term rentals"
                />
                <NumField
                  label="For Services (%)"
                  value={escrowFees.sellerServiceFeePercent}
                  onChange={(v) => setEscrowFees((f) => ({ ...f, sellerServiceFeePercent: v }))}
                  suffix="%" step="0.1"
                  hint="Service providers (cleaning, repairs, etc.)"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              <input
                type="checkbox"
                id="showFeeNote"
                checked={escrowFees.showFeeNoteOnListing}
                onChange={(e) => setEscrowFees((f) => ({ ...f, showFeeNoteOnListing: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="showFeeNote" className="text-sm text-foreground">
                Show fee breakdown note to seller on listing creation form
              </label>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>Example:</strong> Property listed at ₦1,000,000 (for sale).
                Buyer pays ₦{(1000000 * (1 + escrowFees.buyerServiceChargePercent / 100)).toLocaleString()} total.
                Seller receives ₦{(1000000 * (1 - escrowFees.sellerSaleFeePercent / 100)).toLocaleString()}.
                HomveraX earns ₦{Math.round(1000000 * (escrowFees.buyerServiceChargePercent + escrowFees.sellerSaleFeePercent) / 100).toLocaleString()}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
              <NumField
                label="Minimum Payout Amount (₦)"
                value={config.minimumPayoutAmount ?? 5000}
                onChange={(v) => setConfig((c) => ({ ...c, minimumPayoutAmount: v }))}
                prefix="₦"
                hint="Minimum wallet balance to request payout"
              />
              <NumField
                label="Inspection Window (hours)"
                value={config.inspectionWindowHours ?? 72}
                onChange={(v) => setConfig((c) => ({ ...c, inspectionWindowHours: v }))}
                hint="Before escrow auto-releases"
              />
            </div>

            <Button onClick={() => save("Escrow Fees", {
              escrowFees,
              minimumPayoutAmount: config.minimumPayoutAmount,
              inspectionWindowHours: config.inspectionWindowHours,
            })} disabled={!!saving} className="gap-2">
              {saving === "Escrow Fees" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Escrow Fees
            </Button>
          </div>
        </Section>

        {/* ── Inspection Fee ─────────────────────────────────────────────── */}
        <Section
          title="Inspection Fee"
          subtitle="Optional fee charged at inspection booking. Must also enable 'Inspection Fee' in Feature Flags above."
          icon={CheckCircle2}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="inspEnabled"
                checked={inspectionFee.enabled}
                onChange={(e) => setInspectionFee((f) => ({ ...f, enabled: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="inspEnabled" className="text-sm font-medium text-foreground">
                Enable inspection fee
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="Inspection Fee Amount (₦)"
                value={inspectionFee.amount}
                onChange={(v) => setInspectionFee((f) => ({ ...f, amount: v }))}
                prefix="₦"
                hint="Amount paid by buyer to book inspection"
              />
              <div>
                <Label>Fee Label</Label>
                <Input
                  className="mt-1"
                  value={inspectionFee.label}
                  placeholder="e.g. Inspection Fee"
                  onChange={(e) => setInspectionFee((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Who pays?</Label>
              <div className="flex gap-4 mt-2">
                {[
                  { label: "Buyer pays", value: "buyer" as const },
                  { label: "Seller pays", value: "seller" as const },
                ].map(({ label, value }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={inspectionFee.paidBy === value}
                      onChange={() => setInspectionFee((f) => ({ ...f, paidBy: value }))}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Description shown to user</Label>
              <Input
                className="mt-1"
                value={inspectionFee.description}
                onChange={(e) => setInspectionFee((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. A small fee to confirm your inspection and filter serious inquiries"
              />
            </div>

            <Button onClick={() => save("Inspection Fee", { inspectionFee })} disabled={!!saving} className="gap-2">
              {saving === "Inspection Fee" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Inspection Fee
            </Button>
          </div>
        </Section>

        {/* ── Verification Fees ──────────────────────────────────────────── */}
        <Section title="Verification Fees" subtitle="One-time fees for agent and property verification" icon={Shield}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="Agent Verification (₦)"
                value={config.verificationPrices.agent}
                onChange={(v) => setConfig((c) => ({ ...c, verificationPrices: { ...c.verificationPrices, agent: v } }))}
                prefix="₦"
              />
              <NumField
                label="Property Verification (₦)"
                value={config.verificationPrices.property}
                onChange={(v) => setConfig((c) => ({ ...c, verificationPrices: { ...c.verificationPrices, property: v } }))}
                prefix="₦"
              />
            </div>
            <Button onClick={() => save("Verification Fees", { verificationPrices: config.verificationPrices })}
              disabled={!!saving} className="gap-2">
              {saving === "Verification Fees" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Verification Fees
            </Button>
          </div>
        </Section>

        {/* ── Listing Boost Options ──────────────────────────────────────── */}
        <Section title="Listing Boost Prices" subtitle="Prices agents pay to boost individual listings" icon={Tag}>
          <div className="space-y-3">
            {config.boostOptions.map((opt, idx) => (
              <div key={opt.type} className="flex items-center gap-4 p-3 bg-secondary/40 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
                <div className="w-36">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                    <Input
                      type="number"
                      className="pl-7"
                      value={opt.price}
                      onChange={(e) => {
                        const updated = [...config.boostOptions];
                        updated[idx] = { ...opt, price: Number(e.target.value) };
                        setConfig((c) => ({ ...c, boostOptions: updated }));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={() => save("Boost Prices", { boostOptions: config.boostOptions })}
              disabled={!!saving} className="gap-2">
              {saving === "Boost Prices" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Boost Prices
            </Button>
          </div>
        </Section>

        {/* ── Subscription Plans ─────────────────────────────────────────── */}
        <Section title="Subscription Plans" subtitle="Monthly prices agents and landlords pay for listing slots" icon={Star}>
          <div className="space-y-3">
            {config.subscriptionPlans.map((plan, idx) => (
              <div key={plan.slug} className="p-4 bg-secondary/40 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {plan.slug}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Price (₦/month)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                      <Input
                        type="number"
                        className="pl-7"
                        value={plan.price}
                        onChange={(e) => {
                          const updated = [...config.subscriptionPlans];
                          updated[idx] = { ...plan, price: Number(e.target.value) };
                          setConfig((c) => ({ ...c, subscriptionPlans: updated }));
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Max Listings</Label>
                    <Input
                      type="number"
                      className="mt-1"
                      value={plan.maxListings === 999999 ? 0 : plan.maxListings}
                      placeholder="0 = unlimited"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const updated = [...config.subscriptionPlans];
                        updated[idx] = { ...plan, maxListings: val === 0 ? 999999 : val };
                        setConfig((c) => ({ ...c, subscriptionPlans: updated }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">0 = unlimited</p>
                  </div>
                  <div>
                    <Label className="text-xs">Rank Boost (×)</Label>
                    <Input
                      type="number"
                      className="mt-1"
                      value={plan.rankBoost ?? 1}
                      onChange={(e) => {
                        const updated = [...config.subscriptionPlans];
                        updated[idx] = { ...plan, rankBoost: Number(e.target.value) };
                        setConfig((c) => ({ ...c, subscriptionPlans: updated }));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={() => save("Subscription Plans", { subscriptionPlans: config.subscriptionPlans })}
              disabled={!!saving} className="gap-2">
              {saving === "Subscription Plans" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Subscription Plans
            </Button>
          </div>
        </Section>

        {/* ── Featured Agent ─────────────────────────────────────────────── */}
        <Section
          title="Featured Agent Slots"
          subtitle="Agents pay to appear in the homepage 'Verified Agents' section. Enable in Feature Flags above."
          icon={Users}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="Featured Agent Price (₦)"
                value={featuredAgent.price}
                onChange={(v) => setFeaturedAgent((f) => ({ ...f, price: v }))}
                prefix="₦"
                hint="Amount agent pays per slot"
              />
              <NumField
                label="Duration (days)"
                value={featuredAgent.durationDays}
                onChange={(v) => setFeaturedAgent((f) => ({ ...f, durationDays: v }))}
                hint="How long the featured slot lasts"
              />
              <NumField
                label="Max Simultaneous Slots"
                value={featuredAgent.maxSlots}
                onChange={(v) => setFeaturedAgent((f) => ({ ...f, maxSlots: v }))}
                hint="Max agents shown on homepage"
              />
              <div>
                <Label>Display Label</Label>
                <Input
                  className="mt-1"
                  value={featuredAgent.label}
                  onChange={(e) => setFeaturedAgent((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Featured Agent"
                />
              </div>
            </div>
            <Button onClick={() => save("Featured Agent", { featuredAgent })} disabled={!!saving} className="gap-2">
              {saving === "Featured Agent" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Featured Agent Settings
            </Button>
          </div>
        </Section>

        {/* ── Referral Tiers ─────────────────────────────────────────────── */}
        <Section
          title="Referral Program"
          subtitle="Configure all reward tiers, bonuses, and withdrawal limits. Enable in Feature Flags above."
          icon={Gift}
        >
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="refEnabled" checked={referralTiers.enabled}
                onChange={(e) => setReferralTiers((r) => ({ ...r, enabled: e.target.checked }))}
                className="w-4 h-4 rounded" />
              <label htmlFor="refEnabled" className="text-sm font-medium text-foreground">Enable referral program</label>
            </div>

            {/* Signup bonus */}
            <div className="p-4 bg-secondary/40 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={referralTiers.signupBonusEnabled}
                  onChange={(e) => setReferralTiers((r) => ({ ...r, signupBonusEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <p className="text-sm font-semibold text-foreground">Signup Bonus (referrer earns when friend registers)</p>
              </div>
              <NumField label="Signup Bonus Base Amount (₦)" value={referralTiers.signupBonusAmount}
                onChange={(v) => setReferralTiers((r) => ({ ...r, signupBonusAmount: v }))}
                prefix="₦" hint="Added to the role-based bonus below" />
            </div>

            {/* Role-based bonus */}
            <div className="p-4 bg-secondary/40 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-foreground">Extra bonus by referred user's role (added to signup bonus)</p>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Agent Referral Bonus (₦)" value={referralTiers.agentReferralBonus}
                  onChange={(v) => setReferralTiers((r) => ({ ...r, agentReferralBonus: v }))} prefix="₦" />
                <NumField label="Landlord Referral Bonus (₦)" value={referralTiers.landlordReferralBonus}
                  onChange={(v) => setReferralTiers((r) => ({ ...r, landlordReferralBonus: v }))} prefix="₦" />
                <NumField label="Service Provider Bonus (₦)" value={referralTiers.serviceProviderReferralBonus}
                  onChange={(v) => setReferralTiers((r) => ({ ...r, serviceProviderReferralBonus: v }))} prefix="₦" />
                <NumField label="Tenant/Buyer Bonus (₦)" value={referralTiers.tenantReferralBonus}
                  onChange={(v) => setReferralTiers((r) => ({ ...r, tenantReferralBonus: v }))} prefix="₦" />
              </div>
            </div>

            {/* Welcome bonus for referred user */}
            <div className="p-4 bg-secondary/40 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={referralTiers.welcomeBonusEnabled}
                  onChange={(e) => setReferralTiers((r) => ({ ...r, welcomeBonusEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <p className="text-sm font-semibold text-foreground">Welcome Bonus (new user receives this)</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Welcome Bonus Amount (₦)" value={referralTiers.welcomeBonusAmount}
                  onChange={(v) => setReferralTiers((r) => ({ ...r, welcomeBonusAmount: v }))} prefix="₦" />
                <div>
                  <Label>Trigger welcome bonus on</Label>
                  <div className="flex gap-4 mt-2">
                    {[
                      { label: "Registration", value: "signup" as const },
                      { label: "First transaction", value: "first_transaction" as const },
                    ].map(({ label, value }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={referralTiers.welcomeBonusTrigger === value}
                          onChange={() => setReferralTiers((r) => ({ ...r, welcomeBonusTrigger: value }))} />
                        <span className="text-xs">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* First transaction bonus */}
            <div className="p-4 bg-secondary/40 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={referralTiers.firstTransactionBonusEnabled}
                  onChange={(e) => setReferralTiers((r) => ({ ...r, firstTransactionBonusEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <p className="text-sm font-semibold text-foreground">First Transaction Bonus (referrer earns when friend completes first deal)</p>
              </div>
              <NumField label="First Transaction Bonus (₦)" value={referralTiers.firstTransactionBonusAmount}
                onChange={(v) => setReferralTiers((r) => ({ ...r, firstTransactionBonusAmount: v }))} prefix="₦" />
            </div>

            {/* Recurring bonus */}
            <div className="p-4 bg-secondary/40 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={referralTiers.recurringBonusEnabled}
                  onChange={(e) => setReferralTiers((r) => ({ ...r, recurringBonusEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <p className="text-sm font-semibold text-foreground">Recurring Bonus (referrer earns on every subsequent deal)</p>
              </div>
              <div>
                <Label>Bonus type</Label>
                <div className="flex gap-4 mt-2">
                  {[
                    { label: "Flat amount", value: false },
                    { label: "% of escrow", value: true },
                  ].map(({ label, value }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={referralTiers.recurringBonusUsePercent === value}
                        onChange={() => setReferralTiers((r) => ({ ...r, recurringBonusUsePercent: value }))} />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Flat Amount (₦)" value={referralTiers.recurringBonusFlat}
                  onChange={(v) => setReferralTiers((r) => ({ ...r, recurringBonusFlat: v }))}
                  prefix="₦" />
                <NumField label="Percentage (%)" value={referralTiers.recurringBonusPercent}
                  onChange={(v) => setReferralTiers((r) => ({ ...r, recurringBonusPercent: v }))}
                  suffix="%" step="0.1" />
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-4">
              <NumField label="Minimum Withdrawal (₦)" value={referralTiers.minimumWithdrawal}
                onChange={(v) => setReferralTiers((r) => ({ ...r, minimumWithdrawal: v }))}
                prefix="₦" hint="Minimum to request withdrawal" />
              <NumField label="Max Total Earnings (₦)" value={referralTiers.maximumTotalEarnings}
                onChange={(v) => setReferralTiers((r) => ({ ...r, maximumTotalEarnings: v }))}
                prefix="₦" hint="0 = no cap" />
              <NumField label="Link Expiry (days)" value={referralTiers.referralLinkExpiryDays}
                onChange={(v) => setReferralTiers((r) => ({ ...r, referralLinkExpiryDays: v }))}
                hint="0 = never expires" />
            </div>

            <Button onClick={() => save("Referral Program", { referralTiers })} disabled={!!saving} className="gap-2">
              {saving === "Referral Program" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Referral Settings
            </Button>
          </div>
        </Section>

        {/* ── SMS Notifications ──────────────────────────────────────────── */}
        <Section title="SMS Notifications" subtitle="Configure SMS provider and which events trigger SMS alerts" icon={Phone}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SMS Provider</Label>
                <select
                  value={sms.provider}
                  onChange={(e) => setSms((s) => ({ ...s, provider: e.target.value as SmsConfig["provider"] }))}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm"
                >
                  <option value="termii">Termii</option>
                  <option value="africas_talking">Africa's Talking</option>
                  <option value="none">None (disabled)</option>
                </select>
              </div>
              <div>
                <Label>Sender ID / Name</Label>
                <Input className="mt-1" value={sms.senderId} placeholder="e.g. HomveraX"
                  onChange={(e) => setSms((s) => ({ ...s, senderId: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>API Key</Label>
              <Input className="mt-1" type="password" value={sms.apiKey} placeholder="Provider API key"
                onChange={(e) => setSms((s) => ({ ...s, apiKey: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Stored in Firestore — never in code</p>
            </div>
            <div className="pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Send SMS on:</p>
              {[
                { key: "onEscrowFunded" as const, label: "Escrow funded" },
                { key: "onEscrowReleased" as const, label: "Escrow released / payout" },
                { key: "onBookingConfirmed" as const, label: "Booking confirmed" },
                { key: "onNewMessage" as const, label: "New message received" },
                { key: "onPayoutApproved" as const, label: "Payout approved" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <input type="checkbox" checked={sms[key]}
                    onChange={(e) => setSms((s) => ({ ...s, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-foreground">{label}</span>
                </div>
              ))}
            </div>
            <Button onClick={() => save("SMS Settings", { sms })} disabled={!!saving} className="gap-2">
              {saving === "SMS Settings" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save SMS Settings
            </Button>
          </div>
        </Section>

        {/* ── Email Notifications ────────────────────────────────────────── */}
        <Section title="Email Notifications" subtitle="Branded transactional emails via Resend" icon={Mail}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email Provider</Label>
                <select
                  value={emailCfg.provider}
                  onChange={(e) => setEmailCfg((c) => ({ ...c, provider: e.target.value as EmailConfig["provider"] }))}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm"
                >
                  <option value="resend">Resend.com</option>
                  <option value="none">None (disabled)</option>
                </select>
              </div>
              <div>
                <Label>From Name</Label>
                <Input className="mt-1" value={emailCfg.fromName} placeholder="e.g. HomveraX"
                  onChange={(e) => setEmailCfg((c) => ({ ...c, fromName: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>From Email</Label>
                <Input className="mt-1" value={emailCfg.fromEmail} placeholder="noreply@homverax.com"
                  onChange={(e) => setEmailCfg((c) => ({ ...c, fromEmail: e.target.value }))} />
              </div>
            </div>
            <div className="pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Send email on:</p>
              {[
                { key: "onEscrowInitiated" as const, label: "Escrow initiated (seller notified early)" },
                { key: "onEscrowFunded" as const, label: "Escrow funded" },
                { key: "onEscrowReleased" as const, label: "Escrow released" },
                { key: "onBookingConfirmed" as const, label: "Booking confirmed" },
                { key: "onPayoutApproved" as const, label: "Payout approved" },
                { key: "onVerificationApproved" as const, label: "Verification approved" },
                { key: "onSubscriptionActivated" as const, label: "Subscription activated" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <input type="checkbox" checked={emailCfg[key]}
                    onChange={(e) => setEmailCfg((c) => ({ ...c, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-foreground">{label}</span>
                </div>
              ))}
            </div>
            <Button onClick={() => save("Email Settings", { email: emailCfg })} disabled={!!saving} className="gap-2">
              {saving === "Email Settings" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Email Settings
            </Button>

            {/* ── Test Send ────────────────────────────────────────────── */}
            <EmailTestSend />
          </div>
        </Section>

        {/* ── Bank Details ───────────────────────────────────────────────── */}
        {/* ── Payment Methods ────────────────────────────────────────────── */}
        <Section
          title="Payment Methods"
          subtitle="Choose which payment method(s) are available for boost, subscription, and escrow checkout. Enable one or more at once — users will pick between them at checkout when more than one is active."
          icon={CreditCard}
        >
          <div className="space-y-3">
            {([
              { slug: "manual", label: "Manual Bank Transfer", desc: "User transfers to your bank account and uploads proof; you confirm manually." },
              { slug: "paystack", label: "Paystack", desc: "Card, bank, USSD, and transfer checkout via Paystack. Requires NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY to be set." },
              { slug: "flutterwave", label: "Flutterwave", desc: "Card, bank, and mobile money checkout via Flutterwave. Requires NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY to be set." },
            ] as { slug: string; label: string; desc: string }[]).map(({ slug, label, desc }) => {
              const enabled = config.paymentProviders?.includes(slug) ?? slug === "manual";
              return (
                <FeatureToggle
                  key={slug}
                  label={label}
                  description={desc}
                  enabled={enabled}
                  onChange={(v) => {
                    const current = config.paymentProviders?.length ? config.paymentProviders : ["manual"];
                    let updated = v ? [...new Set([...current, slug])] : current.filter((s) => s !== slug);
                    // Never allow zero methods enabled — admin must keep at least one.
                    if (updated.length === 0) {
                      toast.error("At least one payment method must stay enabled");
                      return;
                    }
                    setConfig((c) => ({ ...c, paymentProviders: updated }));
                  }}
                />
              );
            })}
          </div>
          <Button
            onClick={() => save("Payment Methods", { paymentProviders: config.paymentProviders })}
            disabled={!!saving} className="gap-2 mt-4"
          >
            {saving === "Payment Methods" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Payment Methods
          </Button>
        </Section>

        <Section title="Platform Bank Details" subtitle="Account shown to users for manual payments (subscriptions, boosts)" icon={BanknoteIcon}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {([
                { label: "Bank Name", key: "bankName" as const },
                { label: "Account Number", key: "accountNumber" as const },
                { label: "Account Name", key: "accountName" as const },
                { label: "Sort Code", key: "sortCode" as const },
              ] as { label: string; key: keyof BankDetails }[]).map(({ label, key }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input className="mt-1" value={config.bank[key] ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, bank: { ...c.bank, [key]: e.target.value } }))} />
                </div>
              ))}
            </div>
            <div>
              <Label>Bank Note (shown to users)</Label>
              <Input className="mt-1" value={config.bank.bankNote ?? ""}
                placeholder="e.g. Use your name as payment reference"
                onChange={(e) => setConfig((c) => ({ ...c, bank: { ...c.bank, bankNote: e.target.value } }))} />
            </div>
            <Button onClick={() => save("Bank Details", { bank: config.bank })}
              disabled={!!saving} className="gap-2">
              {saving === "Bank Details" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Bank Details
            </Button>
          </div>
        </Section>

        {/* ── General & WhatsApp ─────────────────────────────────────────── */}
        <Section title="General & WhatsApp" subtitle="App name, support contact, and WhatsApp settings" icon={Settings}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>App Name</Label>
                <Input className="mt-1" value={config.appName}
                  onChange={(e) => setConfig((c) => ({ ...c, appName: e.target.value }))} />
              </div>
              <div>
                <Label>Support Email</Label>
                <Input className="mt-1" value={config.supportEmail}
                  onChange={(e) => setConfig((c) => ({ ...c, supportEmail: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>WhatsApp Number (no +)</Label>
                <Input className="mt-1" value={config.whatsApp?.number ?? ""} placeholder="2348012345678"
                  onChange={(e) => setConfig((c) => ({ ...c, whatsApp: { ...c.whatsApp, number: e.target.value } }))} />
              </div>
              <div>
                <Label>Pre-filled Message</Label>
                <Input className="mt-1" value={config.whatsApp?.supportMessage ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, whatsApp: { ...c.whatsApp, supportMessage: e.target.value } }))} />
              </div>
            </div>
            <Button onClick={() => save("General Settings", {
              appName: config.appName, supportEmail: config.supportEmail, whatsApp: config.whatsApp,
            })} disabled={!!saving} className="gap-2">
              {saving === "General Settings" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save General Settings
            </Button>
          </div>
        </Section>

        {/* ── Social Links ───────────────────────────────────────────────── */}
        <Section title="Social Links & Contact" subtitle="URLs shown in the footer. Leave blank to hide." icon={Share2}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: "facebookUrl",  label: "Facebook URL",              placeholder: "https://facebook.com/homverax" },
                { key: "twitterUrl",   label: "Twitter / X URL",           placeholder: "https://twitter.com/homverax" },
                { key: "instagramUrl", label: "Instagram URL",             placeholder: "https://instagram.com/homverax" },
                { key: "linkedInUrl",  label: "LinkedIn URL",              placeholder: "https://linkedin.com/company/homverax" },
                { key: "youtubeUrl",   label: "YouTube URL",               placeholder: "https://youtube.com/@homverax" },
                { key: "contactEmail", label: "Contact Email (footer)",    placeholder: "hello@homverax.com" },
                { key: "contactPhone", label: "Contact Phone (footer)",    placeholder: "+234 800 000 0000" },
              ] as { key: keyof SocialLinks; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input className="mt-1" value={social[key] ?? ""} placeholder={placeholder}
                    onChange={(e) => setSocial((s) => ({ ...s, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <Button onClick={() => save("Social Links", { social })} disabled={!!saving} className="gap-2">
              {saving === "Social Links" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Social Links
            </Button>
          </div>
        </Section>

        {/* ── Homepage CTA ───────────────────────────────────────────────── */}
        <Section
          title="Homepage CTA Section"
          subtitle="Control the headline, subtext, and user count shown in the blue call-to-action banner on the homepage."
          icon={MessageSquare}
        >
          <div className="space-y-4">
            <div>
              <Label>Headline</Label>
              <Input
                className="mt-1"
                placeholder="Ready to Find Your Perfect Property?"
                value={homepageCTA.headline}
                onChange={(e) => setHomepageCTA((prev) => ({ ...prev, headline: e.target.value }))}
              />
            </div>
            <div>
              <Label>Subtext (shown after the user count)</Label>
              <Input
                className="mt-1"
                placeholder="Nigerians who trust HomveraX for safe property transactions."
                value={homepageCTA.subtext}
                onChange={(e) => setHomepageCTA((prev) => ({ ...prev, subtext: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Displays as: "Join over [count] [subtext]"</p>
            </div>
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Override User Count</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enable to show a fixed value (e.g. "7+") instead of the live Firebase count</p>
                </div>
                <button
                  onClick={() => setHomepageCTA((prev) => ({ ...prev, useUserCountOverride: !prev.useUserCountOverride }))}
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative shrink-0",
                    homepageCTA.useUserCountOverride ? "bg-primary" : "bg-secondary border border-border",
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                    homepageCTA.useUserCountOverride ? "left-[22px]" : "left-0.5",
                  )} />
                </button>
              </div>
              <div>
                <Label>{homepageCTA.useUserCountOverride ? "Override Value (shown on homepage)" : "Override Value (inactive — live count shown)"}</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. 7+ or 500+"
                  value={homepageCTA.userCountOverride}
                  disabled={!homepageCTA.useUserCountOverride}
                  onChange={(e) => setHomepageCTA((prev) => ({ ...prev, userCountOverride: e.target.value }))}
                />
              </div>
            </div>
            <Button
              onClick={() => save("Homepage CTA", { homepageCTA })}
              disabled={!!saving}
              className="gap-2"
            >
              {saving === "Homepage CTA" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Homepage CTA
            </Button>
          </div>
        </Section>

        {/* ── Testimonials ───────────────────────────────────────────────── */}
        <Section
          title="Homepage Testimonials"
          subtitle="Edit what users say. Toggle visibility to show/hide individual cards without deleting them."
          icon={Quote}
        >
          <div className="space-y-4">
            {testimonials.map((t, idx) => (
              <div
                key={t.id}
                className={cn(
                  "border rounded-xl p-4 space-y-3 transition-all",
                  t.visible ? "border-border bg-card" : "border-dashed border-border bg-secondary/40 opacity-60",
                )}
              >
                {/* Header row: visibility toggle + delete */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setTestimonials((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, visible: !item.visible } : item)),
                        )
                      }
                      className={cn(
                        "w-10 h-5 rounded-full relative shrink-0 transition-all",
                        t.visible ? "bg-primary" : "bg-secondary border border-border",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                          t.visible ? "left-[22px]" : "left-0.5",
                        )}
                      />
                    </button>
                    <span className="text-xs text-muted-foreground font-medium">
                      {t.visible ? "Visible on homepage" : "Hidden"}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setTestimonials((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-destructive hover:text-destructive/80 p-1 rounded transition-colors"
                    title="Delete testimonial"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Name + Role row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={t.name}
                      onChange={(e) =>
                        setTestimonials((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, name: e.target.value, avatar: e.target.value.charAt(0).toUpperCase() }
                              : item,
                          ),
                        )
                      }
                      placeholder="e.g. Adaeze Okonkwo"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Role / Location</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={t.role}
                      onChange={(e) =>
                        setTestimonials((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, role: e.target.value } : item)),
                        )
                      }
                      placeholder="e.g. Property Buyer, Lagos"
                    />
                  </div>
                </div>

                {/* Rating row */}
                <div>
                  <Label className="text-xs">Rating (1–5 stars)</Label>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() =>
                          setTestimonials((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, rating: star } : item)),
                          )
                        }
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            "w-5 h-5",
                            star <= t.rating ? "fill-accent text-accent" : "text-muted-foreground",
                          )}
                        />
                      </button>
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">{t.rating}/5</span>
                  </div>
                </div>

                {/* Testimonial text */}
                <div>
                  <Label className="text-xs">Testimonial Text</Label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    rows={3}
                    value={t.text}
                    onChange={(e) =>
                      setTestimonials((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, text: e.target.value } : item)),
                      )
                    }
                    placeholder="What did this user say about HomveraX?"
                  />
                </div>
              </div>
            ))}

            {/* Add new testimonial */}
            <button
              onClick={() =>
                setTestimonials((prev) => [
                  ...prev,
                  {
                    id: `t${Date.now()}`,
                    name: "",
                    role: "",
                    avatar: "?",
                    rating: 5,
                    text: "",
                    order: prev.length + 1,
                    visible: true,
                  },
                ])
              }
              className="w-full border-2 border-dashed border-border rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Testimonial
            </button>

            <Button
              onClick={() => save("Testimonials", { testimonials })}
              disabled={!!saving}
              className="gap-2"
            >
              {saving === "Testimonials" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Testimonials
            </Button>
          </div>
        </Section>

      </div>
    </DashboardLayout>
  );
}
