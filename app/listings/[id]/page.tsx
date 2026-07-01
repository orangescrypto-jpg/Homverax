import type { Metadata } from "next";
import { getListingById } from "@/services/listings";
import { APP_NAME, APP_URL } from "@/lib/constants";
import ListingDetailClient from "./ListingDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const listing = await getListingById(id);
    if (!listing) {
      return { title: "Listing Not Found" };
    }
    const title = `${listing.title} — ${listing.location.lga}, ${listing.location.state}`;
    const description = `${listing.description?.slice(0, 155) ?? `${listing.propertyType} for ${listing.listingType} in ${listing.location.state}, Nigeria.`}`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: listing.images?.[0] ? [{ url: listing.images[0], width: 1200, height: 630, alt: listing.title }] : [],
        url: `${APP_URL}/listings/${listing.id}`,
        type: "article",
      },
      twitter: { card: "summary_large_image", title, description },
      alternates: { canonical: `${APP_URL}/listings/${listing.id}` },
    };
  } catch {
    return { title: "Property Listing | " + APP_NAME };
  }
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  return <ListingDetailClient id={id} />;
}
