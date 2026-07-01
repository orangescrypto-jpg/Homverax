"use client";

/**
 * components/features/SellerFeeNote.tsx
 * Shows seller a fee breakdown note when they set a price on listing form.
 * Reads from platformSettings — always up to date with admin changes.
 */

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { getPlatformConfig, calcSellerPlatformFee } from "@/services/platformSettings";
import { formatCurrency } from "@/lib/utils";
import type { EscrowFeeConfig } from "@/services/platformSettings";

interface Props {
  price: number;
  listingType: "sale" | "rent" | "shortlet" | "service";
}

export default function SellerFeeNote({ price, listingType }: Props) {
  const [escrowFees, setEscrowFees] = useState<EscrowFeeConfig | null>(null);

  useEffect(() => {
    getPlatformConfig().then((cfg) => {
      if (cfg.escrowFees.showFeeNoteOnListing) {
        setEscrowFees(cfg.escrowFees);
      }
    });
  }, []);

  if (!escrowFees || price <= 0) return null;

  const { platformFee, sellerReceives, feePercent } = calcSellerPlatformFee(price, listingType, escrowFees);

  return (
    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl flex items-start gap-2">
      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
      <p className="text-xs text-blue-800 dark:text-blue-300">
        A <strong>{feePercent}% platform fee</strong> ({formatCurrency(platformFee)}) will be deducted on payout.
        You will receive <strong>{formatCurrency(sellerReceives)}</strong> after escrow is released.
      </p>
    </div>
  );
}
