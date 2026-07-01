import type { Metadata } from "next";
import { redirect } from "next/navigation";
import InspectionsPageClient from "./InspectionsPageClient";
import { getPlatformConfig } from "@/services/platformSettings";

export const metadata: Metadata = {
  title: "Inspections",
  description: "Manage your property inspection bookings.",
  robots: { index: false, follow: false },
};

/**
 * ✅ FIX: Server-side feature flag gate.
 * If admin disables enableInspectionBooking, /dashboard/inspection
 * redirects to dashboard instead of showing a broken page.
 */
export default async function InspectionPage() {
  const config = await getPlatformConfig();
  if (!config.features.enableInspectionBooking) {
    redirect("/dashboard");
  }
  return <InspectionsPageClient />;
}
