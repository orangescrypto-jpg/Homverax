/**
 * app/api/flash-deals/remove/route.ts
 * POST /api/flash-deals/remove — end a flash deal on the caller's own
 * listing.
 *
 * ✅ FIX: removeFlashDeal() in services/flashDeals.ts called d1Exec()
 * directly from client code, which the admin-gated D1 proxy silently
 * blocked (403) for every non-staff agent. Moved server-side, gated to
 * "signed in" with ownership enforced in the WHERE clause (matches prior
 * behavior) plus an explicit auth check.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Exec } from "@/lib/d1";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { listingId?: string } | null;
  if (!body?.listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE listings SET is_flash_deal = 0, flash_deal_price = NULL, flash_deal_expires_at = NULL, updated_at = ? WHERE id = ? AND agent_id = ?",
    [now, body.listingId, user.id]
  );

  return NextResponse.json({ success: true });
}
