/**
 * services/wallet.ts — backed by Cloudflare D1.
 * Payout requests stored in the dedicated `payouts` table.
 * creditWalletOnRelease is called from escrow.ts after funds are released.
 */

import { d1Query, d1Exec, newId } from "@/lib/d1";
import { getPlatformConfig } from "@/services/platformSettings";
import { sendPayoutApprovedEmail } from "@/services/emailService";

export interface SellerWallet {
  userId: string;
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalPlatformFeesDeducted: number;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: "credit" | "debit" | "hold" | "release" | "payout" | "fee_deduction";
  amount: number;
  description: string;
  escrowId?: string;
  reference?: string;
  createdAt: string;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string;
  grossEscrowAmount?: number;
  platformFeeDeducted?: number;
  status: "pending" | "approved" | "rejected";
  note?: string;
  reference?: string;
  proofUrl?: string;
  payoutMethod?: "manual" | "paystack";
  createdAt: string;
  processedAt?: string;
}

export interface UserBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string;
}

interface WalletRow {
  user_id: string;
  balance: number;
  updated_at: string;
}

interface TxRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string;
  reference: string | null;
  created_at: string;
}

interface PayoutRow {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  bank_code: string | null;
  status: string;
  note: string | null;
  reference: string | null;
  proof_url: string | null;
  payout_method: string | null;
  created_at: string;
  processed_at: string | null;
}

function rowToPayout(row: PayoutRow): PayoutRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    amount: row.amount,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountName: row.account_name,
    bankCode: row.bank_code ?? undefined,
    status: row.status as PayoutRequest["status"],
    note: row.note ?? undefined,
    reference: row.reference ?? undefined,
    proofUrl: row.proof_url ?? undefined,
    payoutMethod: (row.payout_method as PayoutRequest["payoutMethod"]) ?? undefined,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? undefined,
  };
}

// ─── Bank details ─────────────────────────────────────────────────────────────
// ✅ FIX: was calling d1Exec()/d1Query() directly from client dashboard
// pages. Now routed through /api/wallet/mine, which returns bank details
// alongside wallet + transactions in one call (see getOrCreateWallet below
// for the primary read; this remains for standalone save calls).

export async function saveBankDetails(userId: string, details: UserBankDetails): Promise<void> {
  const res = await fetch("/api/wallet/bank-details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to save bank details");
  }
}

export async function getBankDetails(userId: string): Promise<UserBankDetails | null> {
  const res = await fetch("/api/wallet/mine", { cache: "no-store" });
  if (!res.ok) return null;
  const { bankDetails } = await res.json();
  return bankDetails;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
// ✅ FIX: was calling d1Query()/d1Exec() directly from client dashboard
// pages (AgentDashboard, WalletClient, ServiceProviderDashboard, referral
// page). After the admin-gated D1 proxy was introduced, this silently
// blocked every regular (non-staff) user from seeing their own wallet
// balance — the "Wallet Balance ₦0" dashboard bug. Now a public,
// signed-in-only route scoped to the caller's own wallet.
export async function getOrCreateWallet(userId: string): Promise<SellerWallet> {
  const res = await fetch("/api/wallet/mine", { cache: "no-store" });
  if (!res.ok) {
    return { userId, balance: 0, pendingBalance: 0, totalEarned: 0, totalPlatformFeesDeducted: 0, updatedAt: new Date().toISOString() };
  }
  const { wallet } = await res.json();
  return wallet as SellerWallet;
}

async function addWalletTransaction(params: {
  userId: string;
  type: WalletTransaction["type"];
  amount: number;
  description: string;
  reference?: string;
}): Promise<void> {
  const id = newId();
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO wallet_transactions (id, user_id, type, amount, description, reference, created_at) VALUES (?,?,?,?,?,?,?)",
    [id, params.userId, params.type, params.amount, params.description, params.reference ?? null, now]
  );
}

export async function getWalletTransactions(userId: string, pageLimit = 20): Promise<WalletTransaction[]> {
  const res = await fetch("/api/wallet/mine", { cache: "no-store" });
  if (!res.ok) return [];
  const { transactions } = await res.json();
  return (transactions ?? []) as WalletTransaction[];
}

export async function holdFundsForSeller(sellerId: string, amount: number, escrowId: string): Promise<void> {
  await addWalletTransaction({
    userId: sellerId, type: "hold", amount,
    description: `Funds held — escrow ${escrowId.slice(-6).toUpperCase()}`,
  });
}

/**
 * Credit seller wallet when escrow is released.
 * Called from escrow.ts → confirmDelivery() and releaseToSeller().
 * Deducts platform fee and records both transactions.
 */
export async function creditWalletOnRelease(
  sellerId: string,
  grossAmount: number,
  platformFee: number,
  escrowId: string,
): Promise<void> {
  const sellerAmount = grossAmount - platformFee;
  const now = new Date().toISOString();

  // Upsert wallet balance
  await d1Exec(
    `INSERT INTO wallets (user_id, balance, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?, updated_at = ?`,
    [sellerId, sellerAmount, now, sellerAmount, now]
  );

  // Record credit transaction
  await addWalletTransaction({
    userId: sellerId, type: "credit", amount: sellerAmount,
    description: `Payment received — escrow ${escrowId.slice(-6).toUpperCase()}`,
    reference: escrowId,
  });

  // Record platform fee deduction
  await addWalletTransaction({
    userId: sellerId, type: "fee_deduction", amount: platformFee,
    description: `Platform fee — escrow ${escrowId.slice(-6).toUpperCase()}`,
    reference: escrowId,
  });
}

export async function removePendingOnRefund(sellerId: string, amount: number, escrowId: string): Promise<void> {
  await addWalletTransaction({
    userId: sellerId, type: "debit", amount,
    description: `Escrow refunded — ${escrowId.slice(-6).toUpperCase()}`,
  });
}

// ─── Payout requests ──────────────────────────────────────────────────────────

export async function requestPayout(
  userId: string,
  userName: string,
  amount: number,
  bankName: string,
  accountNumber: string,
  accountName: string,
  bankCode?: string,
): Promise<void> {
  const res = await fetch("/api/wallet/mine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, bankName, accountNumber, accountName, bankCode, userName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to request payout");
  }
}

export async function getAllPayoutRequests(
  status?: "pending" | "approved" | "rejected",
): Promise<PayoutRequest[]> {
  if (status) {
    const rows = await d1Query<PayoutRow>(
      "SELECT * FROM payouts WHERE status = ? ORDER BY created_at DESC",
      [status]
    );
    return rows.map(rowToPayout);
  }
  const rows = await d1Query<PayoutRow>(
    "SELECT * FROM payouts ORDER BY created_at DESC",
    []
  );
  return rows.map(rowToPayout);
}

/**
 * Admin approves a payout.
 * Updates the payouts table, then fires the payout_approved email.
 *
 * proofUrl: manual mode only — screenshot/receipt admin attaches as
 * evidence the transfer was actually sent. Without this, a seller
 * disputing "I never got paid" has nothing on record to check against.
 * payoutMethod: which path actually paid this out ("manual" or
 * "paystack") — recorded per-payout since admin can change the platform
 * default mid-flight and old pending requests should keep whatever
 * method they were actually paid through.
 */
export async function approvePayout(
  payoutId: string,
  reference: string,
  note?: string,
  proofUrl?: string,
  payoutMethod?: "manual" | "paystack",
): Promise<void> {
  const now = new Date().toISOString();

  // Fetch payout details first
  const rows = await d1Query<PayoutRow>(
    "SELECT * FROM payouts WHERE id = ?", [payoutId]
  );
  if (!rows.length) throw new Error("Payout not found");
  const payout = rowToPayout(rows[0]);

  // Update payout record
  await d1Exec(
    "UPDATE payouts SET status = 'approved', reference = ?, note = ?, proof_url = ?, payout_method = ?, processed_at = ? WHERE id = ?",
    [reference, note ?? null, proofUrl ?? null, payoutMethod ?? "manual", now, payoutId]
  );

  // ✅ FIX: the wallet ledger only ever recorded "Payout requested — ..." at
  // request time (balance already deducted then). Approval never added a
  // matching "completed" entry, so a seller's transaction history showed a
  // payout debit that silently went nowhere — no confirmation it was ever
  // actually paid, no bank reference visible in the ledger itself.
  await addWalletTransaction({
    userId: payout.userId,
    type: "payout",
    amount: payout.amount,
    description: `Payout completed — ${payout.bankName} ···${payout.accountNumber.slice(-4)} (ref: ${reference})`,
    reference: payoutId,
  });

  // ── Email trigger: payout approved ────────────────────────────────────────
  try {
    const userRows = await d1Query<{ email: string; name: string }>(
      "SELECT email, name FROM users WHERE id = ?", [payout.userId]
    );
    if (userRows.length) {
      void sendPayoutApprovedEmail({
        userEmail:     userRows[0].email,
        userName:      userRows[0].name,
        amount:        payout.amount,
        bankName:      payout.bankName,
        accountNumber: payout.accountNumber,
      });
    }
  } catch (err) {
    console.warn("[wallet] approvePayout email error:", err);
  }
}

export async function rejectPayout(
  payoutId: string,
  userId: string,
  amount: number,
  note?: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Update payout record
  await d1Exec(
    "UPDATE payouts SET status = 'rejected', note = ?, processed_at = ? WHERE id = ?",
    [note ?? null, now, payoutId]
  );

  // Refund balance to wallet
  await d1Exec(
    `INSERT INTO wallets (user_id, balance, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?, updated_at = ?`,
    [userId, amount, now, amount, now]
  );

  await addWalletTransaction({
    userId, type: "credit", amount,
    description: "Payout rejected — balance refunded",
  });
}
