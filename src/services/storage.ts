/**
 * services/storage.ts — Centralised file-upload abstraction
 *
 * Now backed by Cloudflare R2 via the /api/upload route.
 * The browser calls our API route, which streams the file to R2.
 * Same function signatures as the Firebase version.
 */

export type StoragePath =
  | `verifications/${string}/${string}`
  | `subscriptionProofs/${string}/${string}`
  | `boostProofs/${string}/${string}`
  | `listings/${string}/${string}`;

/**
 * Upload a single file via the /api/upload route and return its public URL.
 * This is the ONLY place in the codebase that calls the upload API.
 */
export async function uploadFile(path: StoragePath, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
    throw new Error(err.error ?? "File upload failed");
  }

  const { url } = await res.json() as { url: string };
  return url;
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

export async function uploadVerificationId(userId: string, file: File): Promise<string> {
  return uploadFile(`verifications/${userId}/id-${Date.now()}`, file);
}

export async function uploadVerificationSelfie(userId: string, file: File): Promise<string> {
  return uploadFile(`verifications/${userId}/selfie-${Date.now()}`, file);
}

export async function uploadSubscriptionProof(userId: string, file: File): Promise<string> {
  return uploadFile(`subscriptionProofs/${userId}/${Date.now()}_${file.name}`, file);
}

export async function uploadBoostProof(userId: string, file: File): Promise<string> {
  return uploadFile(`boostProofs/${userId}/${Date.now()}_${file.name}`, file);
}

export async function uploadListingImage(listingId: string, file: File): Promise<string> {
  return uploadFile(`listings/${listingId}/${Date.now()}-${file.name}`, file);
}

export async function uploadListingImages(listingId: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadListingImage(listingId, file));
  }
  return urls;
}
