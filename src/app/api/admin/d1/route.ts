/**
 * app/api/admin/d1/route.ts
 * POST /api/admin/d1 — generic, authenticated proxy to Cloudflare D1.
 *
 * Root cause: dozens of functions in src/services/*.ts call d1Query()/
 * d1Exec() directly, and those need CF_ACCOUNT_ID / CF_D1_DATABASE_ID /
 * CF_API_TOKEN — server-only secrets that are always undefined in the
 * browser. Every admin page built on those services (Overview, Users,
 * Verifications, Escrows, Disputes, Reports, Subscriptions, Boosts,
 * Referrals, Blog, Content, Revenue, ...) was failing the same way as the
 * listings page did.
 *
 * Rather than hand-writing a bespoke server route per function (30+ files,
 * ~150 call sites), lib/d1.ts now routes browser-side calls through this
 * single proxy. It is restricted to admin/moderator sessions only — this
 * is intentionally NOT opened up to all authenticated users, since it
 * accepts a raw SQL string and forwarding that to anonymous or regular
 * users would be a serious injection/authorization risk. Regular-user
 * pages (dashboard, listings, messages, etc.) still need their own
 * dedicated server routes, the same pattern used for
 * /api/admin/listings — this proxy only unblocks staff-only pages.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface D1Result {
  results: Record<string, unknown>[];
  success: boolean;
  errors: { code: number; message: string }[];
}
interface D1Response {
  success: boolean;
  result: D1Result[];
  errors: { code: number; message: string }[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user.user_metadata?.role as string | undefined) ?? "";
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { sql?: string; params?: unknown[] } | null;
  if (!body?.sql) {
    return NextResponse.json({ error: "Missing sql" }, { status: 400 });
  }

  const accountId  = process.env.CF_ACCOUNT_ID;
  const databaseId = process.env.CF_D1_DATABASE_ID;
  const apiToken   = process.env.CF_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) {
    return NextResponse.json({ error: "Missing Cloudflare D1 environment variables on server" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({ sql: body.sql, params: body.params ?? [] }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `D1 HTTP error ${res.status}: ${text}` }, { status: 502 });
  }

  const json = (await res.json()) as D1Response;
  if (!json.success) {
    const msg = json.errors?.[0]?.message ?? "D1 query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ results: json.result?.[0]?.results ?? [] });
}
