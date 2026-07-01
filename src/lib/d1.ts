/**
 * lib/d1.ts
 *
 * Cloudflare D1 HTTP API helper.
 * Works on Vercel (Node.js) and Cloudflare Pages (edge).
 * This is the ONLY file that calls the D1 HTTP API.
 */

interface D1Result {
  results: Record<string, unknown>[];
  success: boolean;
  errors: { code: number; message: string }[];
  meta?: Record<string, unknown>;
}

interface D1Response {
  success: boolean;
  result: D1Result[];
  errors: { code: number; message: string }[];
}

export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const accountId  = process.env.CF_ACCOUNT_ID;
  const databaseId = process.env.CF_D1_DATABASE_ID;
  const apiToken   = process.env.CF_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    throw new Error("Missing Cloudflare D1 environment variables: CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN");
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ sql, params }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 HTTP error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as D1Response;

  if (!json.success) {
    const msg = json.errors?.[0]?.message ?? "D1 query failed";
    throw new Error(`D1 error: ${msg}`);
  }

  return (json.result?.[0]?.results ?? []) as T[];
}

/**
 * Execute a write statement (INSERT / UPDATE / DELETE).
 * Returns the number of rows affected.
 */
export async function d1Exec(sql: string, params: unknown[] = []): Promise<number> {
  const rows = await d1Query(sql, params);
  return (rows as unknown as { changes?: number }[])[0]?.changes ?? 0;
}

/** Convenience: generate a UUID-like ID */
export function newId(): string {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${timestamp}${rand}`;
}
