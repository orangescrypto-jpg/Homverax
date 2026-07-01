/**
 * lib/auth-server.ts
 * Server-side auth helpers for API routes.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { d1Query } from "@/lib/d1";
import type { HomveraxUser, UserRole } from "@/types";

export function createClientFromRequest(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

interface UserRow {
  id: string; email: string; name: string; first_name: string; last_name: string;
  phone: string | null; avatar_url: string | null; role: string; role_selected: number;
  is_verified: number; verification_status: string; subscription_plan: string;
  subscription_expiry: string | null; bank_name: string | null; account_number: string | null;
  account_name: string | null; bank_code: string | null; created_at: string; updated_at: string;
}

export function rowToUser(row: UserRow): HomveraxUser {
  return {
    id: row.id, email: row.email, name: row.name,
    firstName: row.first_name, lastName: row.last_name,
    phone: row.phone ?? undefined, avatarUrl: row.avatar_url ?? undefined,
    role: (row.role as UserRole) ?? "tenant",
    roleSelected: row.role_selected === 1,
    isVerified: row.is_verified === 1,
    verificationStatus: (row.verification_status as HomveraxUser["verificationStatus"]) ?? "none",
    subscriptionPlan: (row.subscription_plan as HomveraxUser["subscriptionPlan"]) ?? "free",
    subscriptionExpiry: row.subscription_expiry ?? undefined,
    bankName: row.bank_name ?? undefined, accountNumber: row.account_number ?? undefined,
    accountName: row.account_name ?? undefined, bankCode: row.bank_code ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function getAuthUser(): Promise<{ supabaseId: string; user: HomveraxUser } | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const rows = await d1Query<UserRow>("SELECT * FROM users WHERE id = ?", [user.id]);
  if (!rows.length) return null;
  return { supabaseId: user.id, user: rowToUser(rows[0]) };
}

export async function requireAuth(): Promise<{ supabaseId: string; user: HomveraxUser }> {
  const result = await getAuthUser();
  if (!result) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return result;
}

export async function requireAdmin(): Promise<{ supabaseId: string; user: HomveraxUser }> {
  const result = await requireAuth();
  if (result.user.role !== "admin" && result.user.role !== "moderator")
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  return result;
}

export async function requireModerator(): Promise<{ supabaseId: string; user: HomveraxUser }> {
  const result = await requireAuth();
  if (!["admin", "moderator"].includes(result.user.role))
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  return result;
}

export function authError(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}
