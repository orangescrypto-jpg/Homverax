/**
 * services/listingGuard.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */
import { d1Query } from "@/lib/d1";

export interface DuplicateCheckResult {
  isDuplicate: boolean; matchType?: "address" | "title";
  existingListingId?: string; existingTitle?: string; confidence: number;
}

export async function checkDuplicateListing(params: {
  address: string; lga: string; state: string; title: string; agentId: string;
}): Promise<DuplicateCheckResult> {
  const { address, lga, state, title, agentId } = params;
  const rows = await d1Query<{ id: string; title: string; address: string }>(
    "SELECT id, title, address FROM listings WHERE agent_id = ? AND lga = ? AND state = ? AND status IN ('active','draft','paused')",
    [agentId, lga, state]
  );

  for (const row of rows) {
    const existingAddress = (row.address ?? "").toLowerCase().trim();
    const checkAddress = address.toLowerCase().trim();
    if (existingAddress && checkAddress && existingAddress === checkAddress) {
      return { isDuplicate: true, matchType: "address", existingListingId: row.id, existingTitle: row.title, confidence: 95 };
    }
    const existingWords = new Set((row.title ?? "").toLowerCase().split(" "));
    const newWords = title.toLowerCase().split(" ");
    const overlap = newWords.filter((w) => w.length > 3 && existingWords.has(w));
    const similarity = overlap.length / Math.max(existingWords.size, newWords.length);
    if (similarity > 0.7) {
      return { isDuplicate: true, matchType: "title", existingListingId: row.id, existingTitle: row.title, confidence: Math.round(similarity * 100) };
    }
  }
  return { isDuplicate: false, confidence: 0 };
}

export async function addWatermark(
  file: File, text = "HomveraX", options: { opacity?: number; position?: string } = {}
): Promise<File> {
  // Client-side watermarking via Canvas API
  if (typeof window === "undefined") return file;
  const { opacity = 0.4 } = options;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  ctx.globalAlpha = opacity;
  ctx.font = `bold ${Math.max(24, bitmap.width / 15)}px sans-serif`;
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillText(text, 0, 0);
  return new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob!], file.name, { type: file.type }));
    }, file.type, 0.9);
  });
}

export async function addWatermarkToFiles(files: File[], text?: string): Promise<File[]> {
  return Promise.all(files.map((f) => addWatermark(f, text)));
}
