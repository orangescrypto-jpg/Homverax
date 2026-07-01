/**
 * app/api/auth/register/route.ts
 * POST /api/auth/register
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { d1Exec } from "@/lib/d1";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      email?: string; password?: string; name?: string;
    };
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "email, password and name are required" }, { status: 400 });
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name },
    });

    if (error) {
      const status = error.message.includes("already") ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    if (!data.user) {
      return NextResponse.json({ error: "User creation failed" }, { status: 500 });
    }

    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName  = nameParts.slice(1).join(" ") ?? "";
    const now       = new Date().toISOString();

    await d1Exec(
      `INSERT OR IGNORE INTO users
         (id, email, name, first_name, last_name, role, role_selected,
          is_verified, verification_status, subscription_plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'tenant', 0, 0, 'none', 'free', ?, ?)`,
      [data.user.id, email, name.trim(), firstName, lastName, now, now]
    );

    return NextResponse.json(
      { id: data.user.id, email, name: name.trim() },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
