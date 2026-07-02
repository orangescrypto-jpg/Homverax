// ─── User ─────────────────────────────────────────────────────────────────────
export type UserRole = "tenant" | "agent" | "landlord" | "service_provider" | "moderator" | "admin";
export type VerificationStatus = "none" | "pending" | "approved" | "rejected";
export type SubscriptionPlanSlug = "free" | "basic" | "pro" | "premium";

export interface HomveraxUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  roleSelected: boolean;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  subscriptionPlan: SubscriptionPlanSlug;
  subscriptionExpiry?: string;
  // Bank details — every user can set these for payouts/withdrawals
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Listing ──────────────────────────────────────────────────────────────────
export type PropertyType =
  | "apartment" | "house" | "duplex" | "flat" | "room"
  | "land" | "commercial" | "shortlet";

export type ServiceType = "cleaning" | "repairs" | "installation" | "logistics" | "other";
export type ListingCategory =
  | "housing" | "services" | "commercial" | "land" | "shortlets"
  | "repair_construction" | "commercial_equipment" | "furniture_home";
export type ListingStatus = "draft" | "active" | "paused" | "sold" | "rented";
export type ListingBoostType = "none" | "featured" | "top_placement" | "urgent";
export type PriceUnit = "per_month" | "per_year" | "per_day" | "per_service" | "total";
export type EscrowListingType = "sale" | "rent" | "shortlet" | "service";

export interface ListingAgent {
  id: string;
  name: string;
  avatarUrl?: string;
  isVerified: boolean;
  phone?: string;
}

export interface PropertyListing {
  id: string;
  agentId: string;
  agent: ListingAgent;
  title: string;
  description: string;
  category: ListingCategory;
  propertyType: PropertyType | ServiceType;
  listingType: "rent" | "sale" | "shortlet" | "service";
  price: number;
  priceUnit: PriceUnit;
  location: {
    state: string;
    lga: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  parkingSpaces?: number;
  areaSqM?: number;
  furnished?: boolean;
  images: string[];
  videoUrl?: string;
  virtualTourUrl?: string;     // YouTube / Matterport / 360° link
  boostType: ListingBoostType;
  boostExpiresAt?: string; // ✅ FIX: previously untracked — boosts never expired
  isPropertyVerified: boolean;
  isFeatured: boolean;
  status: ListingStatus;
  viewsCount: number;
  inquiriesCount: number;
  savedCount: number;
  tags?: string[];
  // Price history — array of { price, date } snapshots
  priceHistory?: { price: number; date: string }[];
  createdAt: string;
  updatedAt: string;
}

// ─── Escrow ───────────────────────────────────────────────────────────────────
export type EscrowStatus =
  | "pending"
  | "awaiting_confirmation"
  | "funded"
  | "held"
  | "inspection"
  | "released"
  | "disputed"
  | "resolved"
  | "refunded";

export interface EscrowTransaction {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  listingLocation: string;
  listingType: EscrowListingType;
  buyerId: string;
  sellerId: string;
  amount: number;                        // listing price
  // Buyer-side fee
  buyerServiceCharge: number;            // amount buyer pays on top
  buyerServiceChargePercent: number;
  buyerServiceChargeLabel: string;       // e.g. "Service Charge"
  buyerTotal: number;                    // amount + buyerServiceCharge
  // Seller-side fee
  platformFee: number;                   // deducted from seller payout
  platformFeePercent: number;
  sellerReceives: number;                // amount - platformFee
  status: EscrowStatus;
  role: "buyer" | "seller";
  paymentReference?: string;
  depositPaidAt?: string;
  fundsHeldAt?: string;
  inspectionDate?: string;
  releasedAt?: string;
  disputeReason?: string;
  disputeOpenedAt?: string;
  resolvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Booking ──────────────────────────────────────────────────────────────────
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface Booking {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  buyerId: string;
  sellerId: string;
  status: BookingStatus;
  message?: string;
  escrowId?: string;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  participants: { id: string; name: string; avatarUrl?: string }[];
  listingId?: string;
  listingTitle?: string;
  listingPrice?: number;
  sellerId?: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  unreadFor?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt?: string;
  createdAt: string;
  type?: "text" | "offer" | "offer_accepted" | "offer_rejected" | "offer_countered";
  offerData?: {
    offerId: string;
    proposedPrice: number;
    originalPrice?: number;
    counterPrice?: number;
    counterNote?: string;
    status: "pending" | "accepted" | "rejected" | "countered";
    note?: string;
    sellerId?: string;
    listingId?: string;
  } | null;
}

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotificationType = "lead" | "payment" | "verification" | "escrow" | "booking" | "system" | "referral";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────────
export interface SubscriptionPlan {
  slug: SubscriptionPlanSlug;
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  maxListings: number;
  highlighted?: boolean;
  rankBoost?: number;
  leadsAccess: boolean;
  verifiedBadge: boolean;
}

export interface ListingBoostOption {
  type: ListingBoostType;
  label: string;
  description: string;
  price: number;
  icon: string;
  durationDays: number; // ✅ FIX: boosts had no configurable duration at all
}

// ─── Verification ─────────────────────────────────────────────────────────────
export interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: "agent" | "property";
  status: VerificationStatus;
  bvn?: string;
  nin?: string;
  idDocumentUrl?: string;
  selfieUrl?: string;
  propertyId?: string;
  amountPaid: number;
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface ListingFilters {
  query?: string;
  category?: ListingCategory;
  state?: string;
  propertyType?: string;
  listingType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  boostType?: ListingBoostType;
  verifiedOnly?: boolean;
  furnished?: boolean;
  page?: number;
  limit?: number;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────
export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  totalEscrows: number;
  escrowValueHeld: number;
  pendingVerifications: number;
  monthlyRevenue: number;
  // Revenue breakdown
  buyerServiceChargeRevenue: number;
  sellerPlatformFeeRevenue: number;
}

// ─── Saved Search ─────────────────────────────────────────────────────────────
export type AlertFrequency = "instant" | "daily" | "weekly" | "never";

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: ListingFilters;
  alertFrequency: AlertFrequency;
  lastAlertSentAt?: string;
  createdAt: string;
}

// ─── Featured Agent ───────────────────────────────────────────────────────────
export interface FeaturedAgentSlot {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  isVerified: boolean;
  totalDeals: number;
  averageRating: number;
  paidAt: string;
  expiresAt: string;
  status: "active" | "expired";
}
