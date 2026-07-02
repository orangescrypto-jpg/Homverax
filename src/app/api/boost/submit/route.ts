/**
 * app/api/boost/submit/route.ts
 * POST /api/boost/submit
 *
 * Root cause: submitBoostPayment() in services/subscriptions.ts calls
 * loadRecords/saveRecords, which call d1Query/d1Exec directly. In the
 * browser those route through /api/admin/d1, which is admin/moderator
 * only (see that route's comment) — so a regular agent's boost payment
 * submission gets a 403 that the page swallows into a generic
 * "Submission failed" toast.
 *
 * This route runs the same D1 writes server-side, gated only to
 * "signed in" (any authenticated user can pay to boost their own
 * listing), matching the pattern already used for /api/listings and
 * /api/listings/analytics.
 *
 * File upload is NOT handled here — the client already uploads the
 * proof file to R2 via /api/upload (that path works fine, since
 * /api/upload is its own properly-gated server route). This endpoint
 * just receives the resulting proofUrl and writes the payment record.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec, newId } from "@/lib/d1";

interface BoostPaymentRecord {
  id: string; userId: string; listingId: string; listingTitle: string;
  boostType: string; boostLabel: string; amount: number; proofUrl?: string;
  status: "pending" | "approved" | "rejected"; createdAt: string;
  processedAt?: string; processedBy?: string;
}

async function loadRecords<T>(key: string): Promise<T[]> {
  const rows = await d1Query<{ value: string }>(
    "SELECT value FROM platform_settings WHERE key = ?", [key]
  );
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as T[]; } catch { return []; }
}

async function saveRecords<T>(key: string, records: T[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [key, JSON.stringify(records), now]
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    listingId?: string; listingTitle?: string; boostType?: string;
    boostLabel?: string; amount?: number; proofUrl?: string;
  } | null;

  if (!body?.listingId || !body.listingTitle || !body.boostType || !body.boostLabel || typeof body.amount !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const records = await loadRecords<BoostPaymentRecord>("boost_payments");
    const id = newId();
    const now = new Date().toISOString();
    const record: BoostPaymentRecord = {
      id,
      userId: user.id,
      listingId: body.listingId,
      listingTitle: body.listingTitle,
      boostType: body.boostType,
      boostLabel: body.boostLabel,
      amount: body.amount,
      proofUrl: body.proofUrl,
      status: "pending",
      createdAt: now,
    };
    records.push(record);
    await saveRecords("boost_payments", records);

    return NextResponse.json({ success: true, record });
  } catch (err) {
    console.error("[/api/boost/submit] error:", err);
    const message = err instanceof Error ? err.message : "Failed to submit boost payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
