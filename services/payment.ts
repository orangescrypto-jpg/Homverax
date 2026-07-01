/**
 * services/payment.ts
 * Provider-agnostic payment layer.
 *
 * FIX: Active provider is now read from platformSettings/config.paymentProvider
 * so admin can switch between manual / paystack / flutterwave from /admin/settings
 * WITHOUT redeploying. Falls back to "manual" if not configured.
 *
 * Admin can also toggle each provider on/off and add their API keys from settings.
 */

import { getPlatformConfig } from "@/services/platformSettings";

export type PaymentProviderSlug = "manual" | "paystack" | "flutterwave";

export interface PaymentInitParams {
  email: string;
  amount: number;          // in Naira (kobo conversion handled per provider)
  reference: string;
  metadata?: Record<string, unknown>;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export interface TransferParams {
  recipientCode?: string;  // Paystack recipient code
  accountNumber: string;
  bankCode?: string;
  bankName: string;
  accountName: string;
  amount: number;
  reference: string;
  reason: string;
}

export interface IPaymentProvider {
  name: string;
  label: string;
  initializePayment: (params: PaymentInitParams) => void;
  transferToSeller?: (params: TransferParams) => Promise<{
    success: boolean;
    reference: string;
    error?: string;
  }>;
}

// ─── Manual provider ──────────────────────────────────────────────────────────

const ManualProvider: IPaymentProvider = {
  name:  "manual",
  label: "Manual Bank Transfer",
  initializePayment({ onSuccess, reference }) {
    // Manual = user makes bank transfer offline, UI shows bank details
    // Just resolve with the reference — UI handles the rest
    onSuccess(reference);
  },
};

// ─── Paystack provider ────────────────────────────────────────────────────────

const PaystackProvider: IPaymentProvider = {
  name:  "paystack",
  label: "Paystack",
  initializePayment({ email, amount, reference, metadata, onSuccess, onClose }) {
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      console.error("Paystack public key not configured");
      onClose();
      return;
    }
    const handler = (window as any).PaystackPop?.setup({
      key:      publicKey,
      email,
      amount:   amount * 100, // kobo
      ref:      reference,
      metadata,
      callback: (response: { reference: string }) => onSuccess(response.reference),
      onClose,
    });
    handler?.openIframe();
  },

  async transferToSeller(params) {
    try {
      const res = await fetch("/api/payments/transfer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ provider: "paystack", ...params }),
      });
      const data = await res.json();
      return { success: data.success, reference: data.reference, error: data.error };
    } catch (err: any) {
      return { success: false, reference: params.reference, error: err.message };
    }
  },
};

// ─── Flutterwave provider ─────────────────────────────────────────────────────

const FlutterwaveProvider: IPaymentProvider = {
  name:  "flutterwave",
  label: "Flutterwave",
  initializePayment({ email, amount, reference, metadata, onSuccess, onClose }) {
    const publicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
    if (!publicKey) {
      console.error("Flutterwave public key not configured");
      onClose();
      return;
    }
    (window as any).FlutterwaveCheckout?.({
      public_key:     publicKey,
      tx_ref:         reference,
      amount,
      currency:       "NGN",
      customer:       { email },
      customizations: { title: "HomveraX Escrow", description: "Secure property payment" },
      meta:           metadata,
      callback:       (response: { tx_ref: string }) => onSuccess(response.tx_ref),
      onclose:        onClose,
    });
  },

  async transferToSeller(params) {
    try {
      const res = await fetch("/api/payments/transfer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ provider: "flutterwave", ...params }),
      });
      const data = await res.json();
      return { success: data.success, reference: data.reference, error: data.error };
    } catch (err: any) {
      return { success: false, reference: params.reference, error: err.message };
    }
  },
};

// ─── Provider registry ────────────────────────────────────────────────────────

export const PAYMENT_PROVIDERS: Record<PaymentProviderSlug, IPaymentProvider> = {
  manual:      ManualProvider,
  paystack:    PaystackProvider,
  flutterwave: FlutterwaveProvider,
};

// ─── Get active provider from admin settings ──────────────────────────────────
// ✅ FIX: Reads from Firestore so admin can switch without redeploy

let _cachedProvider: PaymentProviderSlug | null = null;
let _cacheExpiry = 0;

export async function getActivePaymentProvider(): Promise<IPaymentProvider> {
  const now = Date.now();
  // Cache for 60s to avoid hammering Firestore on every payment
  if (_cachedProvider && now < _cacheExpiry) {
    return PAYMENT_PROVIDERS[_cachedProvider] ?? ManualProvider;
  }

  try {
    const cfg = await getPlatformConfig();
    const slug = cfg.paymentProvider as PaymentProviderSlug ?? "manual";
    _cachedProvider = slug;
    _cacheExpiry = now + 60_000;
    return PAYMENT_PROVIDERS[slug] ?? ManualProvider;
  } catch {
    return ManualProvider;
  }
}

/** Initialize payment with admin-configured provider */
export async function initializePayment(params: PaymentInitParams): Promise<void> {
  const provider = await getActivePaymentProvider();
  provider.initializePayment(params);
}

/** Transfer to seller with admin-configured provider */
export async function transferToSeller(
  params: TransferParams
): Promise<{ success: boolean; reference: string; error?: string }> {
  const provider = await getActivePaymentProvider();
  if (!provider.transferToSeller) {
    return { success: true, reference: params.reference };
  }
  return provider.transferToSeller(params);
}

/** Server-side Paystack verification (used by API routes) */
export async function verifyPaystackPayment(reference: string): Promise<{
  success: boolean;
  amount: number;
  email: string;
  metadata?: Record<string, unknown>;
}> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.warn("PAYSTACK_SECRET_KEY not configured");
    return { success: false, amount: 0, email: "" };
  }

  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const data = await res.json();
    if (data.status && data.data?.status === "success") {
      return {
        success:  true,
        amount:   data.data.amount / 100,
        email:    data.data.customer?.email ?? "",
        metadata: data.data.metadata,
      };
    }
    return { success: false, amount: 0, email: "" };
  } catch (err) {
    console.error("Paystack verification error:", err);
    return { success: false, amount: 0, email: "" };
  }
}
