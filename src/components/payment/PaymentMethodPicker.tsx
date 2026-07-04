"use client";

/**
 * PaymentMethodPicker
 *
 * Admin can now enable more than one payment method at once (e.g. Manual +
 * Paystack together, from /admin/settings). Wherever a "Pay Now" button
 * exists (escrow, boost, subscription, etc), drop this above the button so
 * the user can choose HOW to pay before hitting Pay.
 *
 * - If only ONE provider is enabled, this renders nothing and auto-selects
 *   it — no extra tap needed, same UX as before multi-provider support.
 * - If MORE THAN ONE is enabled, shows inline radio-style options using
 *   user-facing labels only (never the provider's brand name — e.g.
 *   "Pay with Card / Bank (Online)" instead of "Paystack").
 *
 * Usage:
 *   const { slug, providers, Picker } = usePaymentMethod();
 *   ...
 *   <Picker />
 *   <Button onClick={() => initializePayment(params, slug)}>Pay Now</Button>
 */

import { useEffect, useState } from "react";
import { Landmark, CreditCard, Loader2 } from "lucide-react";
import {
  getActivePaymentProviders,
  type IPaymentProvider,
  type PaymentProviderSlug,
} from "@/services/payment";

const ICONS: Record<string, React.ElementType> = {
  manual: Landmark,
  paystack: CreditCard,
  flutterwave: CreditCard,
};

interface PaymentMethodPickerProps {
  value: PaymentProviderSlug | null;
  onChange: (slug: PaymentProviderSlug) => void;
  providers: IPaymentProvider[];
  className?: string;
}

/** Pure presentational picker — use the usePaymentMethod() hook below to
 * wire it up with zero boilerplate in each checkout page. */
export function PaymentMethodPicker({ value, onChange, providers, className }: PaymentMethodPickerProps) {
  if (providers.length <= 1) return null; // nothing to choose — auto-selected

  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground mb-2">Pay with</p>
      <div className="space-y-2">
        {providers.map((p) => {
          const Icon = ICONS[p.name] ?? CreditCard;
          const selected = value === p.name;
          return (
            <label
              key={p.name}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="payment-method"
                checked={selected}
                onChange={() => onChange(p.name as PaymentProviderSlug)}
                className="accent-primary"
              />
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">{p.pickerLabel}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook: fetches admin-enabled providers, auto-selects the sole one if only
 * one is active, and gives back everything a checkout page needs.
 */
export function usePaymentMethod() {
  const [providers, setProviders] = useState<IPaymentProvider[]>([]);
  const [slug, setSlug] = useState<PaymentProviderSlug | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getActivePaymentProviders()
      .then((list) => {
        setProviders(list);
        if (list.length === 1) setSlug(list[0].name as PaymentProviderSlug);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const Picker = (props: Omit<PaymentMethodPickerProps, "value" | "onChange" | "providers">) => (
    <PaymentMethodPicker value={slug} onChange={setSlug} providers={providers} {...props} />
  );

  const LoadingIndicator = isLoading ? (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading payment options…
    </div>
  ) : null;

  return { slug, setSlug, providers, isLoading, Picker, LoadingIndicator };
}
