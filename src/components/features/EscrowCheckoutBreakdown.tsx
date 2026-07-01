"use client";

/**
 * components/features/EscrowCheckoutBreakdown.tsx
 * Shows buyer a fee breakdown before confirming escrow.
 * All values calculated from platformSettings.
 */

import { Shield, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { EscrowFeeBreakdown } from "@/services/escrow";

interface Props {
  breakdown: EscrowFeeBreakdown;
}

export default function EscrowCheckoutBreakdown({ breakdown }: Props) {
  return (
    <div className="bg-secondary/50 border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-green-500" />
        <p className="text-sm font-semibold text-foreground">Payment Breakdown</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Listing Price</span>
          <span className="text-foreground font-medium">{formatCurrency(breakdown.listingPrice)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            {breakdown.buyerServiceChargeLabel}
            <span className="text-xs">({breakdown.buyerServiceChargePercent}%)</span>
          </span>
          <span className="text-foreground font-medium">+ {formatCurrency(breakdown.buyerServiceCharge)}</span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
          <span className="text-foreground">Total to Transfer</span>
          <span className="text-primary text-base">{formatCurrency(breakdown.buyerTotal)}</span>
        </div>
      </div>

      <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl">
        <Info className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
        <p className="text-xs text-green-800 dark:text-green-300">
          Your payment is held securely in escrow. Funds are only released to the seller
          after you confirm delivery or the inspection window closes.
        </p>
      </div>
    </div>
  );
}
