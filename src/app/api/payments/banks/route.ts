/**
 * app/api/payments/banks/route.ts
 * GET — returns the list of Nigerian banks (name + code) from Paystack.
 *
 * Used to populate the bank dropdown on the seller withdrawal form
 * (WalletClient.tsx). Paystack's Transfers API requires a bank_code, not
 * a free-text bank name — this is what makes automatic Paystack payout
 * possible at all.
 */
import { NextResponse } from "next/server";

let cache: { banks: { name: string; code: string }[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // bank list barely changes — cache a day

export async function GET() {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({ banks: cache.banks });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "PAYSTACK_SECRET_KEY not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.paystack.co/bank?country=nigeria&currency=NGN", {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const data = await res.json();
    if (!res.ok || !data.status) {
      return NextResponse.json({ error: data.message || "Could not fetch bank list" }, { status: 400 });
    }

    const banks = (data.data as Array<{ name: string; code: string }>)
      .map((b) => ({ name: b.name, code: b.code }))
      .sort((a, b) => a.name.localeCompare(b.name));

    cache = { banks, fetchedAt: Date.now() };
    return NextResponse.json({ banks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load banks" }, { status: 500 });
  }
}
