/**
 * app/api/auth/resend-verification/route.ts
 * POST /api/auth/resend-verification
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string };
    if (!body.email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: body.email,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
