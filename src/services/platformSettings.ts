/**
 * src/services/platformSettings.ts
 * Central platform configuration — backed by Cloudflare D1.
 * All types, defaults, and function signatures identical to the Firestore version.
 */

import { d1Query, d1Exec } from "@/lib/d1";
import {
  SUBSCRIPTION_PLANS, LISTING_BOOST_OPTIONS,
  BANK_DETAILS, VERIFICATION_PRICES, PLATFORM_FEE_PERCENT,
} from "@/lib/constants";
import type { SubscriptionPlan, ListingBoostOption } from "@/types";

// ─── Types (unchanged) ────────────────────────────────────────────────────────

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  sortCode: string;
  bankNote?: string;
}

export interface VerificationPrices {
  agent: number;
  property: number;
}

export interface EscrowFeeConfig {
  buyerServiceChargePercent: number;
  buyerServiceChargeLabel: string;
  sellerSaleFeePercent: number;
  sellerRentalFeePercent: number;
  sellerShortletFeePercent: number;
  sellerServiceFeePercent: number;
  showFeeNoteOnListing: boolean;
}

export interface InspectionFeeConfig {
  enabled: boolean;
  amount: number;
  label: string;
  paidBy: "buyer" | "seller";
  description: string;
}

export interface FeaturedAgentConfig {
  enabled: boolean;
  price: number;
  durationDays: number;
  maxSlots: number;
  label: string;
}

export interface SmsConfig {
  enabled: boolean;
  provider: "termii" | "africas_talking" | "none";
  senderId: string;
  apiKey: string;
  onEscrowFunded: boolean;
  onEscrowReleased: boolean;
  onBookingConfirmed: boolean;
  onNewMessage: boolean;
  onPayoutApproved: boolean;
}

export interface EmailConfig {
  enabled: boolean;
  provider: "resend" | "none";
  fromName: string;
  fromEmail: string;
  onEscrowInitiated: boolean;
  onEscrowFunded: boolean;
  onEscrowReleased: boolean;
  onBookingConfirmed: boolean;
  onPayoutApproved: boolean;
  onVerificationApproved: boolean;
  onSubscriptionActivated: boolean;
}

export interface ReferralTierConfig {
  enabled: boolean;
  signupBonusEnabled: boolean;
  signupBonusAmount: number;
  welcomeBonusEnabled: boolean;
  welcomeBonusAmount: number;
  welcomeBonusTrigger: "signup" | "first_transaction";
  firstTransactionBonusEnabled: boolean;
  firstTransactionBonusAmount: number;
  recurringBonusEnabled: boolean;
  recurringBonusFlat: number;
  recurringBonusPercent: number;
  recurringBonusUsePercent: boolean;
  agentReferralBonus: number;
  landlordReferralBonus: number;
  serviceProviderReferralBonus: number;
  tenantReferralBonus: number;
  minimumWithdrawal: number;
  maximumTotalEarnings: number;
  referralLinkExpiryDays: number;
}

export interface FeatureFlags {
  enableDuplicateDetection: boolean;
  enableAutoWatermark: boolean;
  enablePriceHistory: boolean;
  enableListingAnalytics: boolean;
  enableDocumentVerification: boolean;
  enableVirtualTour: boolean;
  enablePropertyComparison: boolean;
  enableInstallmentPayments: boolean;
  enableAutoReleaseEscrow: boolean;
  enableAutoResolveDisputes: boolean;
  enableSellerWallet: boolean;
  enableReferralProgram: boolean;
  enableBVNVerification: boolean;
  enableSavedSearchAlerts: boolean;
  enablePushNotifications: boolean;
  enableOfferSystem: boolean;
  enableInspectionBooking: boolean;
  enableReviewsAndRatings: boolean;
  enableMortgageCalculator: boolean;
  enableMarketTrends: boolean;
  enableLiveChat: boolean;
  enableAgentLeaderboard: boolean;
  enablePropertyComparison2: boolean;
  enablePWA: boolean;
  enableBlogSection: boolean;
  maintenanceMode: boolean;
  enableFlashDeals: boolean;
  enableBadges: boolean;
  enableSearchAlerts: boolean;
  enableEscrowTracker: boolean;
  enableStockAlerts: boolean;
  enableRentalsPage: boolean;
  enableSmsNotifications: boolean;
  enableEmailNotifications: boolean;
  enableFeaturedAgents: boolean;
  enableInspectionFee: boolean;
  enableBulkListingImport: boolean;
  enableMarketplace: boolean;
  enableAdBoost: boolean;
  enableAiChatbot: boolean;
}

export interface WhatsAppContact {
  name: string;
  number: string;
  label?: string;
  message?: string;
}

export interface WhatsAppConfig {
  number: string;
  supportMessage: string;
  enabled: boolean;
  contacts: WhatsAppContact[];
}

export interface SocialLinks {
  facebookUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  linkedInUrl: string;
  youtubeUrl: string;
  contactEmail: string;
  contactPhone: string;
}

export interface HomepageStat {
  key: string;
  label: string;
  overrideValue?: string | number | null;
  useOverride: boolean;
}

export interface HomepageCTA {
  headline: string;
  subtext: string;
  userCountOverride: string;
  useUserCountOverride: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  text: string;
  order: number;
  visible: boolean;
}

export interface UploadLimits {
  maxImages: number;
  maxFileSizeMB: number;
}

export interface PlatformConfig {
  platformFeePercent: number;
  escrowFees: EscrowFeeConfig;
  inspectionFee: InspectionFeeConfig;
  featuredAgent: FeaturedAgentConfig;
  sms: SmsConfig;
  email: EmailConfig;
  referralTiers: ReferralTierConfig;
  bank: BankDetails;
  verificationPrices: VerificationPrices;
  subscriptionPlans: SubscriptionPlan[];
  boostOptions: ListingBoostOption[];
  appName: string;
  supportEmail: string;
  whatsApp: WhatsAppConfig;
  social: SocialLinks;
  features: FeatureFlags;
  inspectionWindowHours: number;
  disputeAutoResolveHours: number;
  minimumPayoutAmount: number;
  homepageStats: HomepageStat[];
  homepageCTA: HomepageCTA;
  testimonials: Testimonial[];
  uploadLimits: UploadLimits;
  flashDealMaxDiscountPercent: number;
  flashDealMaxDurationHours: number;
  stockAlertThresholds: {
    highViewsNoInquiry: number;
    highViewsNoBooking: number;
    highSavesNoContact: number;
    staleDays: number;
  };
  listingsPerPage: number;
  /** @deprecated use paymentProviders (array) — kept for old records, migrated on read */
  paymentProvider?: string;
  /** Admin can enable one or more payment methods at once (min 1). */
  paymentProviders: string[];
  messagingRateLimitPerHour: number;
  enableImageCompression: boolean;
  imageCompressionQuality: number;
  imageCompressionMaxWidthPx: number;
  updatedBy?: string;
  _updatedBy?: string;
}

// ─── Defaults (unchanged) ─────────────────────────────────────────────────────

export const DEFAULT_ESCROW_FEES: EscrowFeeConfig = {
  buyerServiceChargePercent: 1.0,
  buyerServiceChargeLabel: "Service Charge",
  sellerSaleFeePercent: 2.5,
  sellerRentalFeePercent: 2.0,
  sellerShortletFeePercent: 3.0,
  sellerServiceFeePercent: 3.5,
  showFeeNoteOnListing: true,
};

export const DEFAULT_INSPECTION_FEE: InspectionFeeConfig = {
  enabled: false,
  amount: 2000,
  label: "Inspection Fee",
  paidBy: "buyer",
  description: "A small fee to confirm your inspection request and filter serious buyers.",
};

export const DEFAULT_FEATURED_AGENT: FeaturedAgentConfig = {
  enabled: false,
  price: 15000,
  durationDays: 30,
  maxSlots: 6,
  label: "Featured Agent",
};

export const DEFAULT_SMS_CONFIG: SmsConfig = {
  enabled: false,
  provider: "termii",
  senderId: "HomveraX",
  apiKey: "",
  onEscrowFunded: true,
  onEscrowReleased: true,
  onBookingConfirmed: true,
  onNewMessage: false,
  onPayoutApproved: true,
};

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  enabled: false,
  provider: "resend",
  fromName: "HomveraX",
  fromEmail: "noreply@homverax.com",
  onEscrowInitiated: true,
  onEscrowFunded: true,
  onEscrowReleased: true,
  onBookingConfirmed: true,
  onPayoutApproved: true,
  onVerificationApproved: true,
  onSubscriptionActivated: true,
};

export const DEFAULT_REFERRAL_TIERS: ReferralTierConfig = {
  enabled: true,
  signupBonusEnabled: true,
  signupBonusAmount: 500,
  welcomeBonusEnabled: true,
  welcomeBonusAmount: 300,
  welcomeBonusTrigger: "first_transaction",
  firstTransactionBonusEnabled: true,
  firstTransactionBonusAmount: 1000,
  recurringBonusEnabled: true,
  recurringBonusFlat: 500,
  recurringBonusPercent: 2,
  recurringBonusUsePercent: false,
  agentReferralBonus: 2000,
  landlordReferralBonus: 1500,
  serviceProviderReferralBonus: 1000,
  tenantReferralBonus: 500,
  minimumWithdrawal: 5000,
  maximumTotalEarnings: 0,
  referralLinkExpiryDays: 0,
};

export const DEFAULT_FEATURES: FeatureFlags = {
  enableDuplicateDetection: true,
  enableAutoWatermark: false,
  enablePriceHistory: true,
  enableListingAnalytics: true,
  enableDocumentVerification: true,
  enableVirtualTour: false,
  enablePropertyComparison: true,
  enableInstallmentPayments: false,
  enableAutoReleaseEscrow: true,
  enableAutoResolveDisputes: true,
  enableSellerWallet: true,
  enableReferralProgram: true,
  enableBVNVerification: false,
  enableSavedSearchAlerts: true,
  enablePushNotifications: true,
  enableOfferSystem: true,
  enableInspectionBooking: true,
  enableReviewsAndRatings: true,
  enableMortgageCalculator: true,
  enableMarketTrends: true,
  enableLiveChat: true,
  enableAgentLeaderboard: false,
  enablePropertyComparison2: true,
  enablePWA: true,
  enableBlogSection: true,
  maintenanceMode: false,
  enableFlashDeals: true,
  enableBadges: true,
  enableSearchAlerts: true,
  enableEscrowTracker: true,
  enableStockAlerts: true,
  enableRentalsPage: true,
  enableSmsNotifications: false,
  enableEmailNotifications: false,
  enableFeaturedAgents: false,
  enableInspectionFee: false,
  enableBulkListingImport: false,
  enableMarketplace: true,
  enableAdBoost: false,
  enableAiChatbot: true,
};

export const DEFAULT_SOCIAL: SocialLinks = {
  facebookUrl: "",
  twitterUrl: "",
  instagramUrl: "",
  linkedInUrl: "",
  youtubeUrl: "",
  contactEmail: "hello@homverax.com",
  contactPhone: "",
};

export const DEFAULT_HOMEPAGE_STATS: HomepageStat[] = [
  { key: "activeListings", label: "Active Listings",   useOverride: false, overrideValue: null },
  { key: "verifiedAgents", label: "Verified Agents",   useOverride: false, overrideValue: null },
  { key: "escrowTotal",    label: "Secured in Escrow", useOverride: false, overrideValue: null },
  { key: "happyClients",   label: "Happy Clients",     useOverride: true,  overrideValue: "7+" },
];

export const DEFAULT_HOMEPAGE_CTA: HomepageCTA = {
  headline: "Ready to Find Your Perfect Property?",
  subtext: "Nigerians who trust HomveraX for safe property transactions.",
  userCountOverride: "7+",
  useUserCountOverride: true,
};

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "t1", name: "Adaeze Okonkwo", role: "Property Buyer, Lagos",
    avatar: "A", rating: 5, order: 1, visible: true,
    text: "HomveraX made finding my apartment in Lekki so easy. The escrow payment gave me complete peace of mind — I knew my money was safe until I moved in.",
  },
  {
    id: "t2", name: "Emeka Nwosu", role: "Real Estate Agent, Abuja",
    avatar: "E", rating: 5, order: 2, visible: true,
    text: "As an agent, the verification system and professional tools have helped me close more deals. My clients trust me more because of the verified badge.",
  },
  {
    id: "t3", name: "Fatima Aliyu", role: "Service Provider, Kano",
    avatar: "F", rating: 5, order: 3, visible: true,
    text: "I list my cleaning services here and get consistent bookings. The payment protection means I always get paid for completed work.",
  },
];

export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  maxImages: 10,
  maxFileSizeMB: 5,
};

export const DEFAULT_CONFIG: PlatformConfig = {
  platformFeePercent: PLATFORM_FEE_PERCENT,
  escrowFees: DEFAULT_ESCROW_FEES,
  inspectionFee: DEFAULT_INSPECTION_FEE,
  featuredAgent: DEFAULT_FEATURED_AGENT,
  sms: DEFAULT_SMS_CONFIG,
  email: DEFAULT_EMAIL_CONFIG,
  referralTiers: DEFAULT_REFERRAL_TIERS,
  bank: { ...BANK_DETAILS },
  verificationPrices: { ...VERIFICATION_PRICES },
  subscriptionPlans: SUBSCRIPTION_PLANS.map((p) => ({
    ...p,
    maxListings: p.maxListings === Infinity ? 999999 : p.maxListings,
  })),
  boostOptions: LISTING_BOOST_OPTIONS,
  appName: "HomveraX",
  supportEmail: "hello@homverax.com",
  whatsApp: {
    number: "2348012345678",
    supportMessage: "Hello, I need help with HomveraX",
    enabled: true,
    contacts: [],
  },
  social: { ...DEFAULT_SOCIAL },
  features: DEFAULT_FEATURES,
  inspectionWindowHours: 72,
  disputeAutoResolveHours: 48,
  minimumPayoutAmount: 5000,
  homepageStats: DEFAULT_HOMEPAGE_STATS,
  homepageCTA: DEFAULT_HOMEPAGE_CTA,
  testimonials: DEFAULT_TESTIMONIALS,
  uploadLimits: DEFAULT_UPLOAD_LIMITS,
  flashDealMaxDiscountPercent: 70,
  flashDealMaxDurationHours: 168,
  stockAlertThresholds: {
    highViewsNoInquiry: 100,
    highViewsNoBooking: 50,
    highSavesNoContact: 20,
    staleDays: 30,
  },
  listingsPerPage: 12,
  paymentProviders: ["manual"],
  messagingRateLimitPerHour: 60,
  enableImageCompression: true,
  imageCompressionQuality: 0.8,
  imageCompressionMaxWidthPx: 1920,
};

// ─── D1-backed cache + CRUD ───────────────────────────────────────────────────

// ✅ FIX: this used to be `getPlatformConfig()` itself, called directly
// from client components via d1Query(). After the admin-gated D1 proxy
// was introduced, this silently failed for every non-staff visitor,
// meaning testimonials, homepage stats, and — critically — the buyer
// escrow fee percent all silently fell back to hardcoded defaults for
// every regular visitor, ignoring whatever the admin actually configured.
// This function does the real DB read + merge and is meant to be called
// server-side only (from the /api/config route). The public
// getPlatformConfig() below is now a thin client-side fetch wrapper.
export async function loadPlatformConfigFromDb(): Promise<PlatformConfig> {
  try {
    const rows = await d1Query<{ value: string }>(
      "SELECT value FROM platform_settings WHERE key = 'config'",
      []
    );
    if (rows.length && rows[0].value) {
      const data = JSON.parse(rows[0].value) as Partial<PlatformConfig>;
      // ✅ Migrate legacy single-provider configs: old records saved
      // `paymentProvider: "paystack"` before multi-provider support existed.
      // Without this, those admins would silently drop back to "manual only".
      const migratedProviders =
        data.paymentProviders ??
        (data.paymentProvider ? [data.paymentProvider] : DEFAULT_CONFIG.paymentProviders);
      return {
        ...DEFAULT_CONFIG,
        ...data,
        paymentProviders: migratedProviders.length ? migratedProviders : DEFAULT_CONFIG.paymentProviders,
        escrowFees: { ...DEFAULT_ESCROW_FEES, ...(data.escrowFees ?? {}) },
        inspectionFee: { ...DEFAULT_INSPECTION_FEE, ...(data.inspectionFee ?? {}) },
        featuredAgent: { ...DEFAULT_FEATURED_AGENT, ...(data.featuredAgent ?? {}) },
        sms: { ...DEFAULT_SMS_CONFIG, ...(data.sms ?? {}) },
        email: { ...DEFAULT_EMAIL_CONFIG, ...(data.email ?? {}) },
        referralTiers: { ...DEFAULT_REFERRAL_TIERS, ...(data.referralTiers ?? {}) },
        features: { ...DEFAULT_FEATURES, ...(data.features ?? {}) },
        whatsApp: {
          ...DEFAULT_CONFIG.whatsApp,
          ...(data.whatsApp ?? {}),
          contacts: (data.whatsApp as Partial<WhatsAppConfig>)?.contacts ?? [],
        },
        social: { ...DEFAULT_SOCIAL, ...(data.social ?? {}) },
        homepageStats: data.homepageStats?.length ? data.homepageStats : DEFAULT_HOMEPAGE_STATS,
        homepageCTA: data.homepageCTA ? { ...DEFAULT_HOMEPAGE_CTA, ...data.homepageCTA } : DEFAULT_HOMEPAGE_CTA,
        testimonials: data.testimonials?.length ? data.testimonials : DEFAULT_TESTIMONIALS,
        uploadLimits: { ...DEFAULT_UPLOAD_LIMITS, ...(data.uploadLimits ?? {}) },
        subscriptionPlans: data.subscriptionPlans?.length
          ? data.subscriptionPlans : DEFAULT_CONFIG.subscriptionPlans,
        boostOptions: data.boostOptions?.length
          ? data.boostOptions : DEFAULT_CONFIG.boostOptions,
      };
    }
    return DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

let _cache: PlatformConfig | null = null;
let _cacheErrorCount = 0;
const MAX_ERROR_RETRIES = 3;

// Client-side: fetch from the public /api/config route (which calls
// loadPlatformConfigFromDb() above server-side), with in-memory caching
// so we don't re-fetch on every component mount.
export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (_cache) return _cache;
  if (_cacheErrorCount >= MAX_ERROR_RETRIES) return DEFAULT_CONFIG;

  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    if (!res.ok) { _cacheErrorCount++; return DEFAULT_CONFIG; }
    _cache = await res.json();
    _cacheErrorCount = 0;
    return _cache!;
  } catch {
    _cacheErrorCount++;
    return DEFAULT_CONFIG;
  }
}

export function invalidateConfigCache() {
  _cache = null;
  _cacheErrorCount = 0;
}

// ✅ FIX: was reading "current" via getPlatformConfig() (which can
// silently fall back to DEFAULT_CONFIG on any failure) then merging and
// writing client-side. If the read failed at the wrong moment, a save
// would wipe out every other previously-customized setting — this looked
// like settings randomly "resetting after some time." Now the whole
// read-merge-write happens atomically server-side.
export async function savePlatformConfig(
  config: Partial<PlatformConfig>,
  adminId: string,
  adminName: string,
): Promise<void> {
  const res = await fetch("/api/admin/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to save settings");
  }
  invalidateConfigCache();
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const config = await getPlatformConfig();
  return config.features;
}

export async function isFeatureEnabled(flag: keyof FeatureFlags): Promise<boolean> {
  const features = await getFeatureFlags();
  return features[flag] as boolean;
}

export function calcBuyerServiceCharge(
  listingPrice: number,
  escrowFees: EscrowFeeConfig,
): { serviceCharge: number; total: number } {
  const serviceCharge = Math.round((listingPrice * escrowFees.buyerServiceChargePercent) / 100);
  return { serviceCharge, total: listingPrice + serviceCharge };
}

export function calcSellerPlatformFee(
  listingPrice: number,
  listingType: "sale" | "rent" | "shortlet" | "service",
  escrowFees: EscrowFeeConfig,
): { platformFee: number; sellerReceives: number; feePercent: number } {
  const feePercent =
    listingType === "sale"     ? escrowFees.sellerSaleFeePercent :
    listingType === "rent"     ? escrowFees.sellerRentalFeePercent :
    listingType === "shortlet" ? escrowFees.sellerShortletFeePercent :
                                 escrowFees.sellerServiceFeePercent;
  const platformFee = Math.round((listingPrice * feePercent) / 100);
  return { platformFee, sellerReceives: listingPrice - platformFee, feePercent };
}
