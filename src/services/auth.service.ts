import { db } from '../models/db.js';
import { apiKeys, users } from '../models/schema.js';
import { eq, and } from 'drizzle-orm';
import { hashApiKey, validateApiKeyFormat } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { PLAN_LIMITS } from '../models/schema.js';
import { getCurrentPeriod, getPeriodResetDate } from '../utils/crypto.js';
import type { Plan, ApiKeyScope } from '../models/schema.js';

export interface AuthResult {
  userId: string;
  plan: Plan;
  apiKeyId: string;
  scope: ApiKeyScope;
  isTestKey: boolean;
}

export async function validateApiKey(
  rawKey: string,
): Promise<AuthResult | null> {
  if (!rawKey) return null;

  const normalizedKey = rawKey.replace(/^Bearer\s+/i, '');
  if (!validateApiKeyFormat(normalizedKey)) {
    return null;
  }

  const keyHash = hashApiKey(normalizedKey);
  const isTestKey = normalizedKey.startsWith('sk_test_');

  const result = await db
    .select({
      apiKeyId: apiKeys.id,
      userId: apiKeys.userId,
      isActive: apiKeys.isActive,
      scope: apiKeys.scope,
      plan: users.plan,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const record = result[0];

  // Update last_used_at (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.apiKeyId))
    .catch((err) => logger.warn({ err }, 'Failed to update last_used_at'));

  return {
    userId: record.userId,
    plan: record.plan as Plan,
    apiKeyId: record.apiKeyId,
    scope: record.scope as ApiKeyScope,
    isTestKey,
  };
}

export async function checkQuota(userId: string, plan: Plan): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetDate: Date;
}> {
  const { year, month } = getCurrentPeriod();
  const limit = PLAN_LIMITS[plan];
  const resetDate = getPeriodResetDate();

  const usageRecord = await db.query.usage.findFirst({
    where: (u, { and, eq }) =>
      and(
        eq(u.userId, userId),
        eq(u.periodYear, year),
        eq(u.periodMonth, month),
      ),
  });

  const used = usageRecord?.invoicesCount ?? 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    resetDate,
  };
}
