/**
 * app/api/wallet/mine/route.ts
 * GET  /api/wallet/mine — the signed-in user's own wallet + recent transactions.
 * POST /api/wallet/mine — request a payout from the signed-in user's own wallet.
 *
 * ✅ FIX: getOrCreateWallet()/getWalletTransactions()/requestPayout() in
 * services/wallet.ts called d1Query()/d1Exec() directly from client
 * dashboard pages (AgentDashboard, WalletClient, ServiceProviderDashboard,
 * referral page). After the admin-gated D1 proxy was introduced, this
 * silently blocked every regular (non-staff) user from seeing their own
 * wallet balance or requesting a payout — exactly the "Wallet Balance ₦0"
 * dashboard bug. This route is scoped to "any signed-in user, own data
 * only" — userId always comes from the authenticated session, never from
 * client input.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { getPlatformConfig } from "@/services/platformSettings";

interface WalletRow { user_id: string; balance: number; updated_at: string; }
interface TxRow {
  id: string; user_id: string; type: string; amount: number;
  description: string; reference: string | null; created_at: string;
}

async function requireUser(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<WalletRow>("SELECT * FROM wallets WHERE user_id = ?", [user.id]);
  const balance = rows.length ? rows[0].balance : 0;
  const walletUpdatedAt = rows.length ? rows[0].updated_at : new Date().toISOString();
  if (!rows.length) {
    await d1Exec("INSERT INTO wallets (user_id, balance, updated_at) VALUES (?, 0, ?)", [user.id, walletUpdatedAt]);
  }

  // ✅ FIX: pendingBalance and totalEarned were hardcoded to 0 here — never
  // actually computed — so both cards on the wallet page always showed ₦0
  // regardless of real activity, even though "Available Balance" (read
  // straight from the wallets table) worked fine. Both are now derived
  // from the wallet_transactions ledger:
  //   totalEarned    = lifetime sum of "credit" transactions (money that
  //                    has landed in the wallet from released escrows),
  //                    regardless of how much has since been withdrawn.
  //   pendingBalance = sum of "hold" transactions (escrow funds the seller
  //                    has acknowledged but that haven't been released
  //                    yet) minus any "debit" reversals (e.g. a held
  //                    escrow that was later refunded to the buyer instead
  //                    of released to the seller).
  const ledgerRows = await d1Query<{ type: string; amount: number }>(
    "SELECT type, amount FROM wallet_transactions WHERE user_id = ?",
    [user.id]
  );
  const totalEarned = ledgerRows
    .filter((r) => r.type === "credit")
    .reduce((sum, r) => sum + r.amount, 0);
  const pendingBalance = ledgerRows
    .filter((r) => r.type === "hold")
    .reduce((sum, r) => sum + r.amount, 0)
    - ledgerRows
    .filter((r) => r.type === "debit")
    .reduce((sum, r) => sum + r.amount, 0);

  const wallet = {
    userId: user.id,
    balance,
    pendingBalance: Math.max(0, pendingBalance),
    totalEarned,
    totalPlatformFeesDeducted: ledgerRows
      .filter((r) => r.type === "fee_deduction")
      .reduce((sum, r) => sum + r.amount, 0),
    updatedAt: walletUpdatedAt,
  };

  const txRows = await d1Query<TxRow>(
    "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    [user.id]
  );
  const transactions = txRows.map((r) => ({
    id: r.id, userId: r.user_id, type: r.type, amount: r.amount,
    description: r.description, reference: r.reference ?? undefined, createdAt: r.created_at,
  }));

  const bankRows = await d1Query<{ bank_name: string | null; account_number: string | null; account_name: string | null; bank_code: string | null }>(
    "SELECT bank_name, account_number, account_name, bank_code FROM users WHERE id = ?",
    [user.id]
  );
  const bankDetails = bankRows.length && bankRows[0].bank_name
    ? { bankName: bankRows[0].bank_name, accountNumber: bankRows[0].account_number ?? "", accountName: bankRows[0].account_name ?? "", bankCode: bankRows[0].bank_code ?? undefined }
    : null;

  return NextResponse.json({ wallet, transactions, bankDetails });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { amount, bankName, accountNumber, accountName, bankCode, userName } = body ?? {};
  if (!amount || !bankName || !accountNumber || !accountName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const cfg = await getPlatformConfig();
  const walletRows = await d1Query<WalletRow>("SELECT * FROM wallets WHERE user_id = ?", [user.id]);
  const balance = walletRows[0]?.balance ?? 0;

  if (amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (amount < cfg.minimumPayoutAmount) {
    return NextResponse.json({ error: `Minimum payout is ₦${cfg.minimumPayoutAmount.toLocaleString()}` }, { status: 400 });
  }
  if (amount > balance) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });

  const now = new Date().toISOString();

  await d1Exec(
    "UPDATE users SET bank_name = ?, account_number = ?, account_name = ?, bank_code = ?, updated_at = ? WHERE id = ?",
    [bankName, accountNumber, accountName, bankCode ?? null, now, user.id]
  );

  await d1Exec(
    "UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE user_id = ?",
    [amount, now, user.id]
  );

  const txId = newId();
  await d1Exec(
    "INSERT INTO wallet_transactions (id, user_id, type, amount, description, reference, created_at) VALUES (?,?,?,?,?,?,?)",
    [txId, user.id, "payout", amount, `Payout requested — ${bankName} ···${String(accountNumber).slice(-4)}`, null, now]
  );

  const payoutId = newId();
  await d1Exec(
    `INSERT INTO payouts (id, user_id, user_name, amount, bank_name, account_number, account_name, bank_code, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [payoutId, user.id, userName ?? user.email ?? "Unknown", amount, bankName, accountNumber, accountName, bankCode ?? null, now]
  );

  return NextResponse.json({ success: true });
}
