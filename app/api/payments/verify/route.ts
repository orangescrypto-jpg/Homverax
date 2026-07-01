import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackPayment } from "@/services/payment";

/**
 * POST /api/payments/verify
 * Called after Paystack popup closes successfully.
 * Verifies the payment server-side before funding the escrow.
 */
export async function POST(req: NextRequest) {
  try {
    const { reference, escrowId } = await req.json();

    if (!reference || !escrowId) {
      return NextResponse.json({ error: "Missing reference or escrowId" }, { status: 400 });
    }

    const isValid = await verifyPaystackPayment(reference);

    if (!isValid) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 402 });
    }

    return NextResponse.json({ success: true, reference });
  } catch (err) {
    console.error("Payment verify error:", err);
    return NextResponse.json({ error: "Server error during verification" }, { status: 500 });
  }
}
