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
    durationDays: 0,
  },
  {
    type: "featured",
    label: "Featured Listing",
    description: "Larger card with gold border, shown prominently. Gets 5× more views on average.",
    price: 3000,
    icon: "star",
    durationDays: 7,
  },
  {
    type: "top_placement",
    label: "Top of Search",
    description: "Pinned to the very top of search results for 7 days. Maximum visibility.",
    price: 5000,
    icon: "rocket",
    durationDays: 7,
  },
  {
    type: "urgent",
    label: "Urgent Sale Badge",
    description: "Bold urgency badge signals serious sellers. Attracts ready-to-buy tenants.",
    price: 2000,
    icon: "flame",
    durationDays: 14,
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

export const ARTISANS_REPAIR_TYPES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "ac_appliance_repair", label: "AC & Appliance Repair" },
  { value: "painting", label: "Painting & Finishing" },
  { value: "tiling", label: "Tiling & Flooring" },
  { value: "welding_fabrication", label: "Welding & Fabrication" },
  { value: "other_repair", label: "Other Repairs" },
] as const;

export const BUILDING_MATERIALS_TYPES = [
  { value: "cement_blocks", label: "Cement & Blocks" },
  { value: "tiles_flooring", label: "Tiles & Flooring" },
  { value: "roofing", label: "Roofing Sheets" },
  { value: "doors_windows", label: "Doors & Windows" },
  { value: "generator", label: "Generator" },
  { value: "air_conditioning", label: "Air Conditioning" },
  { value: "borehole_pump", label: "Borehole / Water Pump" },
  { value: "heavy_machinery", label: "Heavy Machinery" },
  { value: "other_equipment", label: "Other Materials & Equipment" },
] as const;

export const FURNITURE_HOME_TYPES = [
  { value: "furniture", label: "Furniture" },
  { value: "home_decor", label: "Home Décor" },
  { value: "kitchen_appliances", label: "Kitchen Appliances" },
  { value: "lighting", label: "Lighting" },
  { value: "bedding_curtains", label: "Bedding & Curtains" },
  { value: "other_home", label: "Other Home Items" },
] as const;

export const SOLAR_POWER_TYPES = [
  { value: "solar_panel", label: "Solar Panels" },
  { value: "inverter", label: "Inverters" },
  { value: "battery", label: "Batteries" },
  { value: "installation_service", label: "Installation Service" },
  { value: "other_power", label: "Other Power Equipment" },
] as const;

export const HOME_SERVICE_TYPES = [
  { value: "cleaning", label: "Cleaning" },
  { value: "fumigation", label: "Fumigation" },
  { value: "movers", label: "Movers / Relocation" },
  { value: "interior_design", label: "Interior Design" },
  { value: "other_home_service", label: "Other Home Services" },
] as const;

export const FOOD_GROCERY_TYPES = [
  { value: "foodstuff", label: "Foodstuff" },
  { value: "provisions", label: "Provisions" },
  { value: "bulk_groceries", label: "Bulk Groceries" },
  { value: "other_food", label: "Other Food Items" },
] as const;

export const CLEANING_HOUSEHOLD_TYPES = [
  { value: "cleaning_supplies", label: "Cleaning Supplies" },
  { value: "household_essentials", label: "Household Essentials" },
  { value: "other_household", label: "Other Household Items" },
] as const;


export const LISTING_CATEGORIES = [
  { value: "housing",             label: "Housing",              description: "Apartments, houses, duplexes, flats" },
  { value: "land",                label: "Land",                 description: "Residential, commercial & agricultural land" },
  { value: "shortlets",           label: "Short Stays",          description: "Short-term rentals by the day or week" },
  { value: "furniture_home",      label: "Furniture & Home",     description: "Furniture, décor & home appliances" },
  { value: "building_materials",  label: "Building Materials",   description: "Cement, tiles, roofing, generators, solar & machinery" },
  { value: "artisans_repair",     label: "Artisans & Repairs",   description: "Plumbers, electricians, AC & appliance repair" },
  { value: "solar_power",         label: "Solar & Power",        description: "Inverters, panels, batteries & installation" },
  { value: "home_service",        label: "Home Services",        description: "Cleaning, fumigation, movers & interior design" },
  { value: "food_grocery",        label: "Food & Grocery",       description: "Foodstuff, provisions & bulk groceries" },
  { value: "cleaning_household",  label: "Cleaning & Household", description: "Cleaning supplies & household essentials" },
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
