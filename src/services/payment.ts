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
  label: string;        // shown to ADMIN in settings (can name the provider)
  pickerLabel: string;  // shown to the USER at checkout (no provider name)
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
  pickerLabel: "Bank Transfer (Manual)",
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
  pickerLabel: "Pay with Card / Bank (Online)",
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
  pickerLabel: "Pay with Card / Bank (Online)",
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

// ─── Get active provider(s) from admin settings ───────────────────────────────
// ✅ FIX: Reads from platform config so admin can switch without redeploy.
// Admin can now enable MORE THAN ONE provider at once (e.g. Manual + Paystack
// together). getActivePaymentProviders() returns all enabled ones so the UI
// can show a "how do you want to pay" choice when there's more than one;
// getActivePaymentProvider() (singular) just returns the first enabled one,
// for any code path that doesn't care about letting the user choose.

let _cachedProviders: PaymentProviderSlug[] | null = null;
let _cacheExpiry = 0;

function normalizeSlugs(slugs: string[]): PaymentProviderSlug[] {
  const valid = slugs.filter((s): s is PaymentProviderSlug => s in PAYMENT_PROVIDERS);
  return valid.length ? valid : ["manual"];
}

export async function getActivePaymentProviderSlugs(): Promise<PaymentProviderSlug[]> {
  const now = Date.now();
  // Cache for 60s to avoid hammering the DB on every payment
  if (_cachedProviders && now < _cacheExpiry) return _cachedProviders;

  try {
    const cfg = await getPlatformConfig();
    const raw = cfg.paymentProviders?.length ? cfg.paymentProviders : (cfg.paymentProvider ? [cfg.paymentProvider] : ["manual"]);
    const slugs = normalizeSlugs(raw);
    _cachedProviders = slugs;
    _cacheExpiry = now + 60_000;
    return slugs;
  } catch {
    return ["manual"];
  }
}

/** All currently enabled providers (admin may enable 1 or more at once). */
export async function getActivePaymentProviders(): Promise<IPaymentProvider[]> {
  const slugs = await getActivePaymentProviderSlugs();
  return slugs.map((s) => PAYMENT_PROVIDERS[s]);
}

/** Convenience: first enabled provider. Use getActivePaymentProviders() when
 * more than one may be active and the user should be able to choose. */
export async function getActivePaymentProvider(): Promise<IPaymentProvider> {
  const providers = await getActivePaymentProviders();
  return providers[0] ?? ManualProvider;
}

/**
 * Initialize payment with a specific provider (pass providerSlug when the
 * checkout UI let the user pick, e.g. via <PaymentMethodPicker>). If omitted,
 * falls back to the first enabled provider — fine when only one is active,
 * but callers with multiple active providers should always pass one.
 */
export async function initializePayment(
  params: PaymentInitParams,
  providerSlug?: PaymentProviderSlug,
): Promise<void> {
  const provider = providerSlug
    ? PAYMENT_PROVIDERS[providerSlug] ?? (await getActivePaymentProvider())
    : await getActivePaymentProvider();
  provider.initializePayment(params);
}

/** Transfer to seller — always uses an online provider capable of payouts
 * (manual has no transferToSeller, so this skips it and uses the first
 * online provider that's enabled; falls back to a no-op success for pure
 * manual-only setups, where payout is handled offline by the admin). */
export async function transferToSeller(
  params: TransferParams
): Promise<{ success: boolean; reference: string; error?: string }> {
  const providers = await getActivePaymentProviders();
  const online = providers.find((p) => p.transferToSeller);
  if (!online) {
    return { success: true, reference: params.reference };
  }
  return online.transferToSeller!(params);
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
