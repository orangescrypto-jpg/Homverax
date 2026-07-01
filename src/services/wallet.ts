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
  grossEscrowAmount?: number;
  platformFeeDeducted?: number;
  status: "pending" | "approved" | "rejected";
  note?: string;
  reference?: string;
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
  status: string;
  note: string | null;
  reference: string | null;
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
    status: row.status as PayoutRequest["status"],
    note: row.note ?? undefined,
    reference: row.reference ?? undefined,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? undefined,
  };
}

// ─── Bank details ─────────────────────────────────────────────────────────────

export async function saveBankDetails(userId: string, details: UserBankDetails): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE users SET bank_name = ?, account_number = ?, account_name = ?, bank_code = ?, updated_at = ? WHERE id = ?",
    [details.bankName, details.accountNumber, details.accountName, details.bankCode ?? null, now, userId]
  );
}

export async function getBankDetails(userId: string): Promise<UserBankDetails | null> {
  const rows = await d1Query<{ bank_name: string | null; account_number: string | null; account_name: string | null; bank_code: string | null }>(
    "SELECT bank_name, account_number, account_name, bank_code FROM users WHERE id = ?",
    [userId]
  );
  if (!rows.length || !rows[0].bank_name) return null;
  return {
    bankName: rows[0].bank_name,
    accountNumber: rows[0].account_number ?? "",
    accountName: rows[0].account_name ?? "",
    bankCode: rows[0].bank_code ?? undefined,
  };
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function getOrCreateWallet(userId: string): Promise<SellerWallet> {
  const rows = await d1Query<WalletRow>("SELECT * FROM wallets WHERE user_id = ?", [userId]);
  if (rows.length) {
    return {
      userId,
      balance: rows[0].balance,
      pendingBalance: 0,
      totalEarned: 0,
      totalPlatformFeesDeducted: 0,
      updatedAt: rows[0].updated_at,
    };
  }
  const now = new Date().toISOString();
  await d1Exec(
    "INSERT INTO wallets (user_id, balance, updated_at) VALUES (?, 0, ?)",
    [userId, now]
  );
  return { userId, balance: 0, pendingBalance: 0, totalEarned: 0, totalPlatformFeesDeducted: 0, updatedAt: now };
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
  const rows = await d1Query<TxRow>(
    "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, pageLimit]
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type as WalletTransaction["type"],
    amount: r.amount,
    description: r.description,
    reference: r.reference ?? undefined,
    createdAt: r.created_at,
  }));
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
): Promise<void> {
  const cfg = await getPlatformConfig();
  const wallet = await getOrCreateWallet(userId);

  if (amount <= 0) throw new Error("Invalid amount");
  if (amount < cfg.minimumPayoutAmount) {
    throw new Error(`Minimum payout is ₦${cfg.minimumPayoutAmount.toLocaleString()}`);
  }
  if (amount > wallet.balance) throw new Error("Insufficient balance");

  // Save bank details
  await saveBankDetails(userId, { bankName, accountNumber, accountName });

  // Deduct from wallet immediately (held pending approval)
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE user_id = ?",
    [amount, now, userId]
  );

  // Record wallet transaction
  await addWalletTransaction({
    userId, type: "payout", amount,
    description: `Payout requested — ${bankName} ···${accountNumber.slice(-4)}`,
  });

  // Insert into payouts table
  const id = newId();
  await d1Exec(
    `INSERT INTO payouts (id, user_id, user_name, amount, bank_name, account_number, account_name, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [id, userId, userName, amount, bankName, accountNumber, accountName, now]
  );
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
 */
export async function approvePayout(
  payoutId: string,
  reference: string,
  note?: string,
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
    "UPDATE payouts SET status = 'approved', reference = ?, note = ?, processed_at = ? WHERE id = ?",
    [reference, note ?? null, now, payoutId]
  );

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
