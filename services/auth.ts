/**
 * services/auth.ts
 *
 * ─── ABSTRACTION LAYER ───────────────────────────────────────────────────────
 * All auth operations go through this file.
 * Backed by Supabase Auth + Cloudflare D1.
 *
 * Function signatures are identical to the Firebase version —
 * no page or component files need to change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@/lib/supabase/client";
import { d1Query, d1Exec, newId } from "@/lib/d1";
import type { HomveraxUser, UserRole } from "@/types";

// ─── Row shape returned from D1 ──────────────────────────────────────────────
interface UserRow {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  role_selected: number;
  is_verified: number;
  verification_status: string;
  subscription_plan: string;
  subscription_expiry: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  bank_code: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): HomveraxUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    role: (row.role as UserRole) ?? "tenant",
    roleSelected: row.role_selected === 1,
    isVerified: row.is_verified === 1,
    verificationStatus: (row.verification_status as HomveraxUser["verificationStatus"]) ?? "none",
    subscriptionPlan: (row.subscription_plan as HomveraxUser["subscriptionPlan"]) ?? "free",
    subscriptionExpiry: row.subscription_expiry ?? undefined,
    bankName: row.bank_name ?? undefined,
    accountNumber: row.account_number ?? undefined,
    accountName: row.account_name ?? undefined,
    bankCode: row.bank_code ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchUserFromD1(userId: string): Promise<HomveraxUser | null> {
  const rows = await d1Query<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
  if (!rows.length) return null;
  return rowToUser(rows[0]);
}

// ─── Insert a new user row into D1 ──────────────────────────────────────────
async function insertUserRow(params: {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    `INSERT OR IGNORE INTO users
      (id, email, name, first_name, last_name, avatar_url, role, role_selected,
       is_verified, verification_status, subscription_plan, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'tenant', 0, 0, 'none', 'free', ?, ?)`,
    [
      params.id,
      params.email,
      params.name,
      params.firstName,
      params.lastName,
      params.avatarUrl ?? null,
      now,
      now,
    ]
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function registerWithEmail(
  email: string,
  password: string,
  name: string
): Promise<HomveraxUser> {
  const supabase = createClient();
  const nameParts = name.split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") ?? "";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, first_name: firstName, last_name: lastName } },
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Registration failed — no user returned.");

  await insertUserRow({
    id: data.user.id,
    email,
    name,
    firstName,
    lastName,
  });

  const profile: HomveraxUser = {
    id: data.user.id,
    email,
    name,
    firstName,
    lastName,
    role: "tenant",
    roleSelected: false,
    isVerified: false,
    verificationStatus: "none",
    subscriptionPlan: "free",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return profile;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<HomveraxUser> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (
      error.message.includes("Invalid login credentials") ||
      error.message.includes("Email not confirmed")
    ) {
      throw new Error("Invalid email or password.");
    }
    throw new Error(error.message);
  }

  if (!data.user) throw new Error("Login failed — no user returned.");

  const user = await fetchUserFromD1(data.user.id);
  if (!user) throw new Error("User profile not found. Please contact support.");
  return user;
}

export async function loginWithGoogle(): Promise<HomveraxUser> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw new Error(error.message);

  // Google OAuth redirects — this function won't return a user directly.
  // The callback route handles creating the D1 row.
  // Return a placeholder to satisfy the type — the redirect means this is never reached.
  throw new Error("Redirecting to Google...");
}

export async function logoutUser(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function sendPasswordReset(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  if (error) throw new Error(error.message);
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  // Routed through /api/auth/update-role (server-side) so the role write to
  // D1 and the mirror into Supabase user_metadata happen atomically together.
  // Keeping this off the client also means the Supabase service-role key
  // never needs to reach the browser. `userId` is implicit — the API route
  // identifies the caller from their own session cookie.
  void userId;
  const res = await fetch("/api/auth/update-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to update role");
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<HomveraxUser, "name" | "firstName" | "lastName" | "phone" | "avatarUrl">>
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (updates.name !== undefined)      { fields.push("name = ?");       values.push(updates.name); }
  if (updates.firstName !== undefined) { fields.push("first_name = ?"); values.push(updates.firstName); }
  if (updates.lastName !== undefined)  { fields.push("last_name = ?");  values.push(updates.lastName); }
  if (updates.phone !== undefined)     { fields.push("phone = ?");      values.push(updates.phone); }
  if (updates.avatarUrl !== undefined) { fields.push("avatar_url = ?"); values.push(updates.avatarUrl); }

  values.push(userId);
  await d1Exec(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function updateUserBankDetails(
  userId: string,
  bankName: string,
  accountNumber: string,
  accountName: string
): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE users SET bank_name = ?, account_number = ?, account_name = ?, updated_at = ? WHERE id = ?",
    [bankName.trim(), accountNumber.trim(), accountName.trim(), now, userId]
  );
}

export async function updateUserNotifPrefs(
  userId: string,
  notifPrefs: Record<string, boolean>
): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE users SET notif_prefs = ?, updated_at = ? WHERE id = ?",
    [JSON.stringify(notifPrefs), now, userId]
  );
}

export async function updateUserPrivacyPrefs(
  userId: string,
  privacyPrefs: Record<string, boolean>
): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE users SET privacy_prefs = ?, updated_at = ? WHERE id = ?",
    [JSON.stringify(privacyPrefs), now, userId]
  );
}

export async function updateUserSubscription(
  userId: string,
  plan: string,
  expiry: string
): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE users SET subscription_plan = ?, subscription_expiry = ?, updated_at = ? WHERE id = ?",
    [plan, expiry, now, userId]
  );
}

export async function getAllUsers(pageLimit = 200): Promise<HomveraxUser[]> {
  const rows = await d1Query<UserRow>(
    "SELECT * FROM users ORDER BY created_at DESC LIMIT ?",
    [pageLimit]
  );
  return rows.map(rowToUser);
}

export async function getCurrentUserProfile(userId: string): Promise<HomveraxUser | null> {
  return fetchUserFromD1(userId);
}

export async function getUserById(userId: string): Promise<HomveraxUser | null> {
  return fetchUserFromD1(userId);
}

/**
 * Subscribe to auth state changes.
 * Replaces the old Firebase auth listener.
 * Returns an unsubscribe function.
 */
export function onAuthChange(callback: (user: HomveraxUser | null) => void): () => void {
  const supabase = createClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (!session?.user) {
        callback(null);
        return;
      }
      try {
        const user = await fetchUserFromD1(session.user.id);
        callback(user);
      } catch {
        callback(null);
      }
    }
  );
  return () => subscription.unsubscribe();
}

const RANK_BOOST_BY_PLAN: Record<string, number> = {
  free: 0, basic: 0, pro: 2, premium: 5,
};

export async function stampAgentRankBoost(agentId: string, planSlug: string): Promise<void> {
  const rankBoost = RANK_BOOST_BY_PLAN[planSlug] ?? 0;
  const now = new Date().toISOString();
  await d1Exec(
    "UPDATE listings SET agent_rank_boost = ?, updated_at = ? WHERE agent_id = ? AND status = 'active'",
    [rankBoost, now, agentId]
  );
}

// ─── Auth wrappers (replacing Firebase-specific calls) ───────────────────────

export async function getCurrentUserEmail(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? "";
}

export async function reloadAndCheckVerified(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email_confirmed_at != null;
}

export async function sendVerificationEmail(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("No user signed in");
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
  });
  if (error) throw new Error(error.message);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const supabase = createClient();
  // Re-authenticate by signing in with current password first
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("No user signed in");

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) throw new Error("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
