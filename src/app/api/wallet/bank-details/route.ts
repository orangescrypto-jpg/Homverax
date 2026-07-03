/**
 * app/api/wallet/bank-details/route.ts
 * POST /api/wallet/bank-details — save the signed-in user's bank details
 * without necessarily requesting a payout (used by the standalone
 * Settings → Bank Details page).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Exec } from "@/lib/d1";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { bankName, accountNumber, accountName, bankCode } = body ?? {};
  if (!bankName || !accountNumber || !accountName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE users SET bank_name = ?, account_number = ?, account_name = ?, bank_code = ?, updated_at = ? WHERE id = ?",
    [bankName, accountNumber, accountName, bankCode ?? null, now, user.id]
  );

  return NextResponse.json({ success: true });
}
