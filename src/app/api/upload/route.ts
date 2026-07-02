/**
 * app/api/upload/route.ts
 * POST /api/upload
 *
 * Accepts multipart/form-data with:
 *   - file: File
 *   - path: string (R2 object key)
 *
 * Returns: { url: string }
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";

// ✅ FIX: same timeout reasoning as /api/listings — uploading a file over a
// slow mobile connection can run past the default serverless timeout.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth check — must be signed in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const path = formData.get("path") as string | null;

    if (!file || !path) {
      return NextResponse.json({ error: "file and path are required" }, { status: 400 });
    }

    // Sanitise path — prevent directory traversal
    const safePath = path.replace(/\.\./g, "").replace(/\/\//g, "/").replace(/^\//, "");
    if (!safePath) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // File size check (10 MB max)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToR2(safePath, buffer, file.type || "application/octet-stream");

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
