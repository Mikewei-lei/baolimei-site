import Redis from 'ioredis';
import { ApiError } from './http';
import { serverEnv } from './env';

type Entry = { count: number; resetAt: number };
const memory = new Map<string, Entry>();

const globalForRedis = globalThis as unknown as { __blmRedis?: Redis | null };

function redis(): Redis | null {
  if (!serverEnv.redisUrl) return null;
  if (globalForRedis.__blmRedis === undefined) {
    try {
      const client = new Redis(serverEnv.redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 1500,
      });
      client.on('error', () => {
        // Redis is optional; avoid noisy logs when it is unavailable.
      });
      globalForRedis.__blmRedis = client;
    } catch {
      globalForRedis.__blmRedis = null;
    }
  }
  return globalForRedis.__blmRedis || null;
}

export async function rateLimit(key: string, limit: number, windowSec: number) {
  const namespaced = `blm:rl:${key}`;
  const client = redis();
  if (client) {
    try {
      const count = await client.incr(namespaced);
      if (count === 1) await client.expire(namespaced, windowSec);
      return { ok: count <= limit, remaining: Math.max(0, limit - count), resetSec: windowSec };
    } catch {
      // Fall through to the in-memory limiter.
    }
  }
  const now = Date.now();
  const existing = memory.get(namespaced);
  const entry =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowSec * 1000 };
  entry.count += 1;
  memory.set(namespaced, entry);
  return {
    ok: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}

export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSec: number,
  message = '请求过于频繁，请稍后再试'
) {
  const result = await rateLimit(key, limit, windowSec);
  if (!result.ok) {
    throw new ApiError(429, 'RATE_LIMITED', message, { retryAfter: result.resetSec });
  }
}
