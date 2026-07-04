/**
 * app/api/payments/transfer/route.ts
 * POST — sends a real bank transfer via Paystack Transfers API.
 *
 * services/payment.ts's transferToSeller() already calls this exact path
 * ("/api/payments/transfer") for the Paystack and Flutterwave providers —
 * but the route never existed, so any automatic payout attempt was
 * silently 404ing. This is the missing piece.
 *
 * Only reached when platform config has payoutMethod = "paystack".
 * Requires PAYSTACK_SECRET_KEY, and the Paystack account needs live
 * transfers unlocked (business KYC completed) — test mode transfers only
 * work against Paystack's test recipients.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unauthorized" }, { status: err.status ?? 401 });
  }

  try {
    const { provider, amount, accountName, accountNumber, bankCode, reference, reason } = await request.json();

    if (provider !== "paystack") {
      // Flutterwave transfer support isn't implemented yet — fail clearly
      // rather than silently pretending it worked.
      return NextResponse.json({ success: false, error: `Transfer provider "${provider}" not implemented`, reference }, { status: 400 });
    }

    if (!amount || !accountNumber || !bankCode || !reference) {
      return NextResponse.json({ success: false, error: "Missing required transfer fields", reference }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ success: false, error: "PAYSTACK_SECRET_KEY not configured", reference }, { status: 500 });
    }

    // Step 1: create (or reuse) a transfer recipient.
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
    });
    const recipientData = await recipientRes.json();
    if (!recipientRes.ok || !recipientData.status) {
      return NextResponse.json(
        { success: false, error: recipientData.message || "Could not create transfer recipient", reference },
        { status: 400 },
      );
    }
    const recipientCode = recipientData.data.recipient_code;

    // Step 2: initiate the transfer itself. Paystack amounts are in kobo —
    // this codebase stores amounts in Naira, so convert here.
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(amount * 100),
        recipient: recipientCode,
        reference,
        reason: reason || "HomveraX seller payout",
      }),
    });
    const transferData = await transferRes.json();

    if (!transferRes.ok || !transferData.status) {
      // Insufficient Paystack balance is the most common real-world failure
      // — surface it clearly so admin knows to fund the balance rather than
      // seeing a generic "transfer failed".
      return NextResponse.json({ success: false, error: transferData.message || "Transfer failed", reference }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      transferCode: transferData.data.transfer_code,
      transferStatus: transferData.data.status, // "success" | "pending" | "otp" (rare)
      reference,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Transfer failed" }, { status: 500 });
  }
}
