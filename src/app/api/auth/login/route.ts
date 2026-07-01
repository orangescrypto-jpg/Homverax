/**
 * app/api/auth/login/route.ts
 * POST /api/auth/login
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "email and password are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!data.user) {
      return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }

    const rows = await d1Query<Record<string, unknown>>(
      "SELECT * FROM users WHERE id = ?",
      [data.user.id]
    );

    return NextResponse.json({ user: rows[0] ?? null }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
