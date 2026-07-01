/**
 * src/lib/rateLimit.ts
 *
 * Rate limiter backed by Upstash Redis — shared across all serverless
 * instances, so limits actually hold once traffic spreads across more
 * than one warm instance (which an in-memory Map cannot do, since each
 * instance has its own separate memory and never sees the others'
 * request counts).
 *
 * Falls back to a local in-memory store ONLY if Upstash env vars are not
 * configured (e.g. local dev without Redis set up). This fallback has the
 * same per-instance limitation as before, so set UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN in any environment with multiple instances.
 *
 * Usage in any API route:
 *   import { rateLimit } from "@/lib/rateLimit";
 *   const result = await rateLimit(req, { limit: 10, windowMs: 60_000 });
 *   if (!result.success) return NextResponse.json({ error: result.message }, { status: 429 });
 */

import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Identifier prefix for the route (e.g. "subscription", "webhook") */
  prefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  message: string;
}

// ─── Redis client (shared across instances) ───────────────────────────────────
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

if (!redis) {
  console.warn(
    "[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — falling back to in-memory rate " +
    "limiting, which does NOT hold across multiple serverless instances. Set these env " +
    "vars in any environment that scales beyond a single instance."
  );
}

// ─── In-memory fallback store (per-instance only) ──────────────────────────────
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Get client identifier from request.
 * Uses IP from Vercel/Cloudflare headers, falls back to a constant.
 */
function getIdentifier(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "anonymous"
  );
}

function rateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs, message: "OK" };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      message: `Too many requests. Try again in ${Math.ceil((entry.resetAt - now) / 1000)} seconds.`,
    };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt, message: "OK" };
}

async function rateLimitRedis(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;

  try {
    // INCR is atomic across all instances hitting the same Redis store.
    const count = await redis!.incr(windowKey);
    if (count === 1) {
      // First hit in this window — set the key to expire so old windows
      // don't accumulate forever.
      await redis!.pexpire(windowKey, windowMs);
    }

    if (count > limit) {
      return {
        success: false,
        remaining: 0,
        resetAt,
        message: `Too many requests. Try again in ${Math.ceil((resetAt - now) / 1000)} seconds.`,
      };
    }

    return { success: true, remaining: limit - count, resetAt, message: "OK" };
  } catch (err) {
    // Redis unreachable — fail open rather than blocking all traffic, but
    // log loudly so it doesn't go unnoticed.
    console.error("[rateLimit] Redis error, falling back to in-memory for this request:", err);
    return rateLimitMemory(key, limit, windowMs);
  }
}

/**
 * Rate limit a request. Always async now — Redis is a network call.
 * @example
 * const result = await rateLimit(req, { limit: 10, windowMs: 60_000, prefix: "subscription" });
 * if (!result.success) return NextResponse.json({ error: result.message }, { status: 429 });
 */
export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { limit, windowMs, prefix = "api" } = config;
  const identifier = getIdentifier(req);
  const key = `${prefix}:${identifier}`;

  if (redis) {
    return rateLimitRedis(key, limit, windowMs);
  }
  return rateLimitMemory(key, limit, windowMs);
}

// ─── Preset configs for each route ────────────────────────────────────────────

/** 20 requests per minute per IP */
export const SUBSCRIPTION_RATE_LIMIT: RateLimitConfig = {
  limit: 20,
  windowMs: 60_000,
  prefix: "subscription",
};

/** 10 requests per minute per IP */
export const WEBHOOK_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowMs: 60_000,
  prefix: "webhook",
};

/** 30 requests per minute per IP */
export const AI_CHAT_RATE_LIMIT: RateLimitConfig = {
  limit: 30,
  windowMs: 60_000,
  prefix: "ai_chat",
};

/** 5 payout requests per hour per IP */
export const PAYOUT_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowMs: 60 * 60_000,
  prefix: "payout",
};

/** 100 requests per minute per IP — general API/middleware default */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  limit: 100,
  windowMs: 60_000,
  prefix: "global",
};

