"use client";

/**
 * components/features/LivePayoutBreakdown.tsx
 *
 * Shows seller a real-time payout breakdown as they type a price.
 * All fee % values read directly from admin settings (D1).
 * Updates instantly when price changes — no page reload needed.
 *
 * Usage:
 *   <LivePayoutBreakdown price={watchedPrice} listingType="sale" />
 *   <LivePayoutBreakdown price={watchedPrice} listingType="service" />
 */

import { useEffect, useState } from "react";
import { Info, TrendingDown } from "lucide-react";
import { getPlatformConfig, calcSellerPlatformFee } from "@/services/platformSettings";
import { formatCurrency } from "@/lib/utils";
import type { EscrowFeeConfig, InspectionFeeConfig } from "@/services/platformSettings";

export type BreakdownListingType = "sale" | "rent" | "shortlet" | "service";

interface Props {
  price: number;
  listingType: BreakdownListingType;
}

interface FeeConfig {
  escrowFees: EscrowFeeConfig;
  inspectionFee: InspectionFeeConfig;
  minimumPayoutAmount: number;
}

// Singleton cache — load once per page, don't re-fetch on every keystroke
let _feeConfig: FeeConfig | null = null;
let _feeConfigLoading = false;
const _listeners: Array<(cfg: FeeConfig) => void> = [];

function loadFeeConfig(): Promise<FeeConfig> {
  return new Promise((resolve) => {
    if (_feeConfig) { resolve(_feeConfig); return; }

    _listeners.push(resolve);

    if (!_feeConfigLoading) {
      _feeConfigLoading = true;
      getPlatformConfig().then((cfg) => {
        _feeConfig = {
          escrowFees: cfg.escrowFees,
          inspectionFee: cfg.inspectionFee,
          minimumPayoutAmount: cfg.minimumPayoutAmount ?? 5000,
        };
        _listeners.forEach((fn) => fn(_feeConfig!));
        _listeners.length = 0;
      }).catch(() => {
        // Fallback defaults if Firestore unreachable
        const fallback: FeeConfig = {
          escrowFees: {
            buyerServiceChargePercent: 1,
            buyerServiceChargeLabel: "Service Charge",
            sellerSaleFeePercent: 2.5,
            sellerRentalFeePercent: 2,
            sellerShortletFeePercent: 3,
            sellerServiceFeePercent: 3.5,
            showFeeNoteOnListing: true,
          },
          inspectionFee: {
            enabled: false,
            amount: 2000,
            label: "Inspection Fee",
            paidBy: "buyer",
            description: "",
          },
          minimumPayoutAmount: 5000,
        };
        _feeConfig = fallback;
        _listeners.forEach((fn) => fn(fallback));
        _listeners.length = 0;
      });
    }
  });
}

export default function LivePayoutBreakdown({ price, listingType }: Props) {
  const [cfg, setCfg] = useState<FeeConfig | null>(null);

  useEffect(() => {
    loadFeeConfig().then(setCfg);
  }, []);

  // Nothing to show until config loaded or price entered
  if (!cfg || !price || price <= 0) return null;
  if (!cfg.escrowFees.showFeeNoteOnListing) return null;

  const { platformFee, sellerReceives, feePercent } = calcSellerPlatformFee(
    price, listingType, cfg.escrowFees,
  );

  // Fixed withdrawal fee (if any — currently 0, but could be set later)
  const withdrawalFee = 0;
  const netPayout = sellerReceives - withdrawalFee;

  // Label per listing type
  const listingTypeLabel =
    listingType === "sale"     ? "Property Sale" :
    listingType === "rent"     ? "Rental" :
    listingType === "shortlet" ? "Shortlet" :
                                 "Service";

  return (
    <div className="mt-3 rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200 dark:border-blue-800/40">
        <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
          Payout breakdown for {formatCurrency(price)}:
        </p>
      </div>

      {/* Fee lines */}
      <div className="px-4 py-3 space-y-1.5">
        {/* Platform fee */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <TrendingDown className="w-3 h-3" />
            <span>
              <strong>-{formatCurrency(platformFee)}</strong>
              {" "}platform fee ({feePercent}%) — {listingTypeLabel.toLowerCase()} escrow & service
            </span>
          </span>
        </div>

        {/* Inspection fee if enabled and seller pays */}
        {cfg.inspectionFee.enabled && cfg.inspectionFee.paidBy === "seller" && (
          <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300">
            <TrendingDown className="w-3 h-3" />
            <span>
              <strong>-{formatCurrency(cfg.inspectionFee.amount)}</strong>
              {" "}{cfg.inspectionFee.label} (per inspection)
            </span>
          </div>
        )}

        {/* Withdrawal fee if any */}
        {withdrawalFee > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300">
            <TrendingDown className="w-3 h-3" />
            <span>
              <strong>-{formatCurrency(withdrawalFee)}</strong>
              {" "}withdrawal fee (fixed, on payout)
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-blue-200 dark:border-blue-700/40 pt-2 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
              You receive after settlement:
            </span>
            <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
              {formatCurrency(netPayout)}
            </span>
          </div>
        </div>

        {/* Min payout note */}
        {netPayout < cfg.minimumPayoutAmount && price > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            ⚠️ Minimum payout is {formatCurrency(cfg.minimumPayoutAmount)}. Set a higher price to enable withdrawal.
          </p>
        )}
      </div>
    </div>
  );
}
