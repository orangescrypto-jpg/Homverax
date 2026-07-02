/**
 * app/api/config/route.ts
 * GET /api/config — public platform configuration (testimonials, homepage
 * stats, escrow fee percentages, feature flags, etc).
 *
 * ✅ FIX: see loadPlatformConfigFromDb() in services/platformSettings.ts
 * for the full explanation — this used to be read directly via d1Query()
 * from client components, which silently failed for every non-staff
 * visitor once the admin-gated D1 proxy was introduced.
 *
 * This is intentionally public/unauthenticated: none of this data is
 * sensitive (no API keys or secrets live in PlatformConfig), and every
 * visitor to the site needs it to render the homepage and correct fees.
 */
import { NextResponse } from "next/server";
import { loadPlatformConfigFromDb } from "@/services/platformSettings";

export async function GET() {
  const config = await loadPlatformConfigFromDb();
  return NextResponse.json(config);
}
