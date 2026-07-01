import type { Metadata } from "next";
import ListingsClient from "@/app/listings/ListingsClient";

export const metadata: Metadata = {
  title: "Houses & Flats for Rent in Nigeria",
  description:
    "Browse verified houses, flats, and apartments for rent in Lagos, Abuja, Port Harcourt and across Nigeria. Escrow-protected payments on HomveraX.",
  keywords: ["house for rent Nigeria", "flat to rent Lagos", "apartment rent Abuja", "rental property Nigeria"],
};

/**
 * /rentals — dedicated page for rental listings.
 * Pre-filters by listingType: "rent" so tenants land directly in rent mode.
 * Reuses the existing ListingsClient with default filters pre-set.
 */
export default function RentalsPage() {
  return (
    <ListingsClient
      defaultFilters={{ listingType: "rent" }}
      heroTitle="Houses & Flats for Rent"
      heroSubtitle="Verified rental properties across Nigeria — pay securely with escrow"
      pageSlug="rentals"
    />
  );
}
