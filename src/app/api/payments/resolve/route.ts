/**
 * app/api/payments/resolve/route.ts
 * POST — resolves a bank account number + bank code to its registered
 * account name via Paystack, so the seller can confirm it's really their
 * account before submitting a payout request. Catches typos (wrong digit
 * in account number, wrong bank selected) before money is ever involved.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unauthorized" }, { status: err.status ?? 401 });
  }

  try {
    const { accountNumber, bankCode } = await request.json();
    if (!accountNumber || !bankCode) {
      return NextResponse.json({ error: "accountNumber and bankCode are required" }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "PAYSTACK_SECRET_KEY not configured" }, { status: 500 });
    }

    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const data = await res.json();
    if (!res.ok || !data.status) {
      return NextResponse.json({ error: data.message || "Could not resolve account" }, { status: 400 });
    }

    return NextResponse.json({
      accountName: data.data.account_name,
      accountNumber: data.data.account_number,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Resolve failed" }, { status: 500 });
  }
}
