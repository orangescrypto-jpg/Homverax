import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackPayment } from "@/services/payment";
import { adminConfirmFunding } from "@/services/escrow";

/**
 * POST /api/payments/verify
 * Called after Paystack popup closes successfully.
 * Verifies the payment server-side, then funds the escrow immediately —
 * unlike manual transfer, online payment doesn't need an admin to eyeball
 * a receipt before confirming.
 *
 * ✅ FIX: this previously did `if (!isValid)` on the return value of
 * verifyPaystackPayment(), but that function returns an object
 * ({ success, amount, email }), which is always truthy — so a FAILED
 * verification was silently treated as valid. Also, on success it never
 * actually funded the escrow, so online payments got "verified" but the
 * transaction stayed stuck at "pending" forever.
 */
export async function POST(req: NextRequest) {
  try {
    const { reference, escrowId } = await req.json();

    if (!reference || !escrowId) {
      return NextResponse.json({ error: "Missing reference or escrowId" }, { status: 400 });
    }

    const result = await verifyPaystackPayment(reference);

    if (!result.success) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 402 });
    }

    await adminConfirmFunding(escrowId, `Paid online — Paystack ref ${reference}`);

    return NextResponse.json({ success: true, reference });
  } catch (err) {
    console.error("Payment verify error:", err);
    return NextResponse.json({ error: "Server error during verification" }, { status: 500 });
  }
}
