/**
 * lib/r2.ts
 *
 * Cloudflare R2 upload helper using AWS S3 SDK.
 * R2 is S3-compatible, so @aws-sdk/client-s3 works directly.
 *
 * Server-side only — call from API routes or server actions.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ENDPOINT      = process.env.CF_R2_ENDPOINT!;
const R2_ACCESS_KEY    = process.env.CF_R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY    = process.env.CF_R2_SECRET_ACCESS_KEY!;
const R2_BUCKET        = process.env.CF_R2_BUCKET_NAME!;
const R2_PUBLIC_URL    = process.env.CF_R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
  });
}

/**
 * Upload a file Buffer to R2 and return its public URL.
 * @param key  - The R2 object key (path), e.g. "listings/abc123/image.jpg"
 * @param body - File content as Buffer or Uint8Array
 * @param contentType - MIME type, e.g. "image/jpeg"
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Generate a pre-signed PUT URL so the browser can upload directly to R2.
 * @param key         - The R2 object key
 * @param contentType - MIME type
 * @param expiresIn   - Seconds until the URL expires (default 300 = 5 min)
 */
export async function getR2PresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return { uploadUrl, publicUrl: `${R2_PUBLIC_URL}/${key}` };
}

/**
 * Accept a browser File-like object (from an API route body) and upload to R2.
 */
export async function uploadFileToR2(
  path: string,
  file: { arrayBuffer(): Promise<ArrayBuffer>; type: string; name: string }
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadToR2(path, buffer, file.type || "application/octet-stream");
}
