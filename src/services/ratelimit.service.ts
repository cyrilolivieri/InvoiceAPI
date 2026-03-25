import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { config } from '../config.js';
import { PLAN_RATE_LIMITS } from '../models/schema.js';
import type { Plan } from '../models/schema.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/error-handler.js';

// ─── Redis (Upstash) ─────────────────────────────────────────────────────────

function createRedisClient(): Redis | null {
  if (!config.upstashRedisUrl || !config.upstashRedisToken) {
    logger.warn('Upstash Redis not configured — rate limiting disabled');
    return null;
  }
  return new Redis({
    url: config.upstashRedisUrl,
    token: config.upstashRedisToken,
  });
}

const redis = createRedisClient();

// ─── Rate Limiter Factory ────────────────────────────────────────────────────

function createRateLimiter(plan: Plan): Ratelimit | null {
  if (!redis) return null;

  const limit = PLAN_RATE_LIMITS[plan];

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, '60 s'),
    prefix: `ratelimit:${plan}`,
  });
}

// ─── Rate Limit Check ────────────────────────────────────────────────────────

export async function checkRateLimit(
  identifier: string,
  plan: Plan,
): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
}> {
  if (!redis) {
    return {
      allowed: true,
      remaining: PLAN_RATE_LIMITS[plan],
      limit: PLAN_RATE_LIMITS[plan],
      resetMs: 60_000,
    };
  }

  const limiter = createRateLimiter(plan);
  if (!limiter) {
    return {
      allowed: true,
      remaining: PLAN_RATE_LIMITS[plan],
      limit: PLAN_RATE_LIMITS[plan],
      resetMs: 60_000,
    };
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      remaining: result.remaining,
      limit: result.limit,
      resetMs: result.reset - Date.now(),
    };
  } catch (err) {
    logger.error({ err, identifier }, 'Rate limit check failed');
    return {
      allowed: true,
      remaining: 0,
      limit: PLAN_RATE_LIMITS[plan],
      resetMs: 60_000,
    };
  }
}

// ─── Quota Check ─────────────────────────────────────────────────────────────

export function enforceQuotaHeaders(
  used: number,
  limit: number,
  remaining: number,
  resetMs: number,
): Record<string, string | number> {
  return {
    'X-RateLimit-Limit': limit,
    'X-RateLimit-Remaining': Math.max(0, remaining),
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + resetMs / 1000),
    'X-Quota-Used': used,
    'X-Quota-Limit': limit === Infinity ? 'unlimited' : limit,
  };
}

export function assertQuotaAllowed(allowed: boolean, plan: Plan, used: number, limit: number): void {
  if (!allowed) {
    throw new AppError(
      429,
      'quota_exceeded',
      `Monthly limit reached (${used}/${limit}). Upgrade at https://invoiceapi.ch/upgrade`,
      {
        plan,
        used,
        limit,
        upgrade_url: 'https://invoiceapi.ch/upgrade',
      },
    );
  }
}
