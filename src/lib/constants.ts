import type { SubscriptionPlan, ListingBoostOption } from "@/types";

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    slug: "free",
    name: "Free",
    price: 0,
    interval: "month",
    features: ["Up to 3 active listings", "Basic visibility", "Standard support"],
    maxListings: 3,
    leadsAccess: false,
    verifiedBadge: false,
  },
  {
    slug: "basic",
    name: "Basic",
    price: 5000,
    interval: "month",
    features: [
      "Up to 15 active listings",
      "Verified agent badge",
      "Priority email support",
      "Basic analytics",
    ],
    maxListings: 15,
    verifiedBadge: true,
    leadsAccess: false,
  },
  {
    slug: "pro",
    name: "Pro",
    price: 20000,
    interval: "month",
    features: [
      "Up to 50 active listings",
      "Verified agent badge",
      "Priority ranking in search",
      "Access to tenant leads",
      "Advanced analytics",
      "Dedicated support",
    ],
    maxListings: 50,
    highlighted: true,
    rankBoost: 2,
    leadsAccess: true,
    verifiedBadge: true,
  },
  {
    slug: "premium",
    name: "Premium",
    price: 50000,
    interval: "month",
    features: [
      "Unlimited listings",
      "Verified agent badge",
      "Top priority ranking",
      "Exclusive tenant leads",
      "Full analytics suite",
      "Featured listing slot (1/month)",
      "Dedicated account manager",
      "Property verification discount",
    ],
    maxListings: Infinity,
    rankBoost: 5,
    leadsAccess: true,
    verifiedBadge: true,
  },
];

export const LISTING_BOOST_OPTIONS: ListingBoostOption[] = [
  {
    type: "none",
    label: "Free Listing",
    description: "Standard visibility, shown in regular search results",
    price: 0,
    icon: "eye",
  },
  {
    type: "featured",
    label: "Featured Listing",
    description: "Larger card with gold border, shown prominently. Gets 5× more views on average.",
    price: 3000,
    icon: "star",
  },
  {
    type: "top_placement",
    label: "Top of Search",
    description: "Pinned to the very top of search results for 7 days. Maximum visibility.",
    price: 5000,
    icon: "rocket",
  },
  {
    type: "urgent",
    label: "Urgent Sale Badge",
    description: "Bold urgency badge signals serious sellers. Attracts ready-to-buy tenants.",
    price: 2000,
    icon: "flame",
  },
];

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi",
  "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
  "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT (Abuja)",
] as const;

export const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "duplex", label: "Duplex" },
  { value: "flat", label: "Flat" },
  { value: "room", label: "Room / Self-contain" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial Space" },
  { value: "shortlet", label: "Shortlet" },
] as const;

export const SERVICE_TYPES = [
  { value: "cleaning", label: "Cleaning" },
  { value: "repairs", label: "Repairs" },
  { value: "installation", label: "Installation" },
  { value: "logistics", label: "Logistics" },
  { value: "other", label: "Other Services" },
] as const;

export const COMMERCIAL_TYPES = [
  { value: "office", label: "Office Space" },
  { value: "shop", label: "Shop / Retail" },
  { value: "warehouse", label: "Warehouse" },
  { value: "event_hall", label: "Event Hall" },
  { value: "coworking", label: "Co-working Space" },
  { value: "plaza", label: "Plaza / Complex" },
] as const;

export const LAND_TYPES = [
  { value: "residential_land", label: "Residential Land" },
  { value: "commercial_land", label: "Commercial Land" },
  { value: "agricultural_land", label: "Agricultural Land" },
  { value: "mixed_use_land", label: "Mixed-Use Land" },
] as const;

export const SHORTLET_TYPES = [
  { value: "shortlet_apartment", label: "Shortlet Apartment" },
  { value: "shortlet_house", label: "Shortlet House" },
  { value: "shortlet_studio", label: "Studio / Room" },
  { value: "shortlet_villa", label: "Villa / Luxury" },
] as const;

export const REPAIR_CONSTRUCTION_TYPES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "building_construction", label: "Building & Construction" },
  { value: "painting", label: "Painting & Finishing" },
  { value: "roofing", label: "Roofing" },
  { value: "tiling", label: "Tiling & Flooring" },
  { value: "welding_fabrication", label: "Welding & Fabrication" },
  { value: "other_repair", label: "Other Repairs" },
] as const;

export const COMMERCIAL_EQUIPMENT_TYPES = [
  { value: "generator", label: "Generator" },
  { value: "air_conditioning", label: "Air Conditioning" },
  { value: "borehole_pump", label: "Borehole / Water Pump" },
  { value: "solar_system", label: "Solar System" },
  { value: "heavy_machinery", label: "Heavy Machinery" },
  { value: "other_equipment", label: "Other Equipment" },
] as const;

export const FURNITURE_HOME_TYPES = [
  { value: "furniture", label: "Furniture" },
  { value: "home_decor", label: "Home Décor" },
  { value: "kitchen_appliances", label: "Kitchen Appliances" },
  { value: "lighting", label: "Lighting" },
  { value: "bedding_curtains", label: "Bedding & Curtains" },
  { value: "other_home", label: "Other Home Items" },
] as const;

export const LISTING_CATEGORIES = [
  { value: "housing",              label: "Housing",               description: "Apartments, houses, duplexes, flats" },
  { value: "commercial",           label: "Commercial",            description: "Office spaces, shops, warehouses, event halls" },
  { value: "land",                 label: "Land",                  description: "Residential, commercial & agricultural land" },
  { value: "shortlets",            label: "Short Stays",           description: "Short-term rentals by the day or week" },
  { value: "services",             label: "Services",              description: "Cleaning, logistics, installation & more" },
  { value: "repair_construction",  label: "Repair & Construction", description: "Plumbers, electricians, builders & contractors" },
  { value: "commercial_equipment", label: "Commercial Equipment",  description: "Generators, AC units, solar & machinery" },
  { value: "furniture_home",       label: "Furniture & Home",      description: "Furniture, décor & home appliances" },
] as const;

export const ESCROW_STEPS = [
  { key: "pending",                label: "Escrow Initiated",    description: "Transaction created, awaiting buyer payment" },
  { key: "awaiting_confirmation",  label: "Transfer Submitted",  description: "Buyer has transferred — awaiting admin confirmation" },
  { key: "funded",                 label: "Payment Confirmed",   description: "HomveraX has confirmed receipt of funds" },
  { key: "held",                   label: "Funds Held",          description: "Money is securely held by HomveraX" },
  { key: "inspection",             label: "Inspection Period",   description: "Buyer verifies the property/service" },
  { key: "released",               label: "Funds Released",      description: "Payment released to seller" },
] as const;

/**
 * BANK_DETAILS
 * Your HomveraX escrow bank account.
 * Update these with your real business account details.
 *
 * TO SWITCH TO PAYSTACK LATER:
 *   - Remove the bank transfer UI in dashboard/escrow/[id]/page.tsx
 *   - Uncomment the handlePayWithPaystack button
 *   - Add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY + PAYSTACK_SECRET_KEY to .env.local
 */
export const BANK_DETAILS = {
  bankName:      "Guaranty Trust Bank (GTB)",
  accountNumber: "0123456789",
  accountName:   "HomveraX Escrow Ltd",
  sortCode:      "058152036",
} as const;

export const VERIFICATION_PRICES = {
  agent: 2500,
  property: 5000,
} as const;

export const PLATFORM_FEE_PERCENT = 1.5; // 1.5% escrow fee

export const APP_NAME = "HomveraX";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://homverax.com";
export const APP_DESCRIPTION =
  "Nigeria's most trusted real estate and services marketplace. Find your perfect home, hire verified professionals, and transact securely with escrow protection.";
