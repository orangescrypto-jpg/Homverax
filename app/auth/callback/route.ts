import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { d1Query, d1Exec } from "@/lib/d1";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code     = searchParams.get("code");
  const next     = searchParams.get("next") ?? "/dashboard";
  const errorMsg = searchParams.get("error_description");

  if (errorMsg) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`);
  if (!code)    return NextResponse.redirect(`${origin}/login?error=missing_code`);

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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.message ?? "session_exchange_failed")}`);

  const user = data.session.user;
  try {
    const existing = await d1Query<{ id: string }>("SELECT id FROM users WHERE id = ?", [user.id]);
    if (!existing.length) {
      const name      = (user.user_metadata?.full_name as string) ?? user.email ?? "";
      const nameParts = name.split(" ");
      const firstName = nameParts[0] ?? "";
      const lastName  = nameParts.slice(1).join(" ") ?? "";
      const now       = new Date().toISOString();
      await d1Exec(
        `INSERT OR IGNORE INTO users
           (id, email, name, first_name, last_name, avatar_url, role,
            role_selected, is_verified, verification_status, subscription_plan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'tenant', 0, 0, 'none', 'free', ?, ?)`,
        [user.id, user.email ?? "", name, firstName, lastName,
         (user.user_metadata?.avatar_url as string) ?? null, now, now]
      );
    }
  } catch (d1Err) {
    console.error("[auth/callback] D1 user creation failed:", d1Err);
  }

  const redirectTo = next.startsWith("/") ? `${origin}${next}` : `${origin}/dashboard`;
  return NextResponse.redirect(redirectTo);
}
