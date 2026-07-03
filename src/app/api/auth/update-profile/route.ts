/**
 * app/api/auth/update-profile/route.ts
 * POST /api/auth/update-profile
 *
 * ✅ FIX: services/auth.ts's updateUserProfile(), updateUserBankDetails(),
 * updateUserNotifPrefs(), and updateUserPrivacyPrefs() used to call d1Exec()
 * directly from "use client" pages (e.g. Settings). Since lib/d1.ts routes
 * *browser* D1 calls through the admin/moderator-only proxy at
 * /api/admin/d1, this meant any regular (non-admin) user saving their bank
 * details, profile, or preferences got a silent 403 — surfaced as "Failed
 * to save bank details" etc. This route does the same DB write server-side,
 * scoped only to "signed in", and only ever updates the caller's own row —
 * same self-only pattern as update-role/route.ts.
 *
 * Body: { field: "profile" | "bank" | "notifPrefs" | "privacyPrefs", ...data }
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { d1Exec } from "@/lib/d1";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.field) {
      return NextResponse.json({ error: "Missing field" }, { status: 400 });
    }

    const now = new Date().toISOString();

    switch (body.field) {
      case "bank": {
        const { bankName, accountNumber, accountName } = body;
        if (!bankName?.trim() || !accountNumber?.trim() || !accountName?.trim()) {
          return NextResponse.json({ error: "Missing bank details" }, { status: 400 });
        }
        await d1Exec(
          "UPDATE users SET bank_name = ?, account_number = ?, account_name = ?, updated_at = ? WHERE id = ?",
          [bankName.trim(), accountNumber.trim(), accountName.trim(), now, user.id]
        );
        break;
      }

      case "notifPrefs": {
        const { notifPrefs } = body;
        if (!notifPrefs || typeof notifPrefs !== "object") {
          return NextResponse.json({ error: "Missing notifPrefs" }, { status: 400 });
        }
        await d1Exec(
          "UPDATE users SET notif_prefs = ?, updated_at = ? WHERE id = ?",
          [JSON.stringify(notifPrefs), now, user.id]
        );
        break;
      }

      case "privacyPrefs": {
        const { privacyPrefs } = body;
        if (!privacyPrefs || typeof privacyPrefs !== "object") {
          return NextResponse.json({ error: "Missing privacyPrefs" }, { status: 400 });
        }
        await d1Exec(
          "UPDATE users SET privacy_prefs = ?, updated_at = ? WHERE id = ?",
          [JSON.stringify(privacyPrefs), now, user.id]
        );
        break;
      }

      case "profile": {
        const { updates } = body as { updates?: Record<string, unknown> };
        if (!updates || typeof updates !== "object" || !Object.keys(updates).length) {
          return NextResponse.json({ error: "Missing updates" }, { status: 400 });
        }
        // Whitelist of columns a user may self-update — never role/verification/
        // subscription here, those go through their own admin-gated routes.
        const ALLOWED: Record<string, string> = {
          name: "name",
          firstName: "first_name",
          lastName: "last_name",
          phone: "phone",
          avatarUrl: "avatar_url",
        };
        const fields: string[] = [];
        const values: unknown[] = [];
        for (const [key, val] of Object.entries(updates)) {
          const column = ALLOWED[key];
          if (!column) continue;
          fields.push(`${column} = ?`);
          values.push(val);
        }
        if (!fields.length) {
          return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
        }
        fields.push("updated_at = ?");
        values.push(now, user.id);
        await d1Exec(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown field" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[update-profile] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to save changes" }, { status: 500 });
  }
}
