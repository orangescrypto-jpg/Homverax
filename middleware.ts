import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { rateLimit, DEFAULT_RATE_LIMIT } from "@/lib/rateLimit";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const limit = await rateLimit(request, DEFAULT_RATE_LIMIT);
    if (!limit.success) {
      return new NextResponse(JSON.stringify({ error: limit.message }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const requiresAuth = pathname.startsWith("/dashboard") || pathname.startsWith("/select-role");
  if (requiresAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));

    // Role is mirrored into user_metadata at write time (see
    // /api/auth/update-role), so it's already decoded on this JWT —
    // no per-request network call to D1 needed.
    const role = (user.user_metadata?.role as string | undefined) ?? "";
    if (role !== "admin" && role !== "moderator") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public|manifest.json|sw.js).*)"],
};
