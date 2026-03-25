import { createHash, randomBytes } from 'crypto';
import { logger } from './logger.js';

export function generateApiKey(prefix = 'sk_live'): string {
  const randomPart = randomBytes(24).toString('base64url');
  return `${prefix}_${randomPart}`;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 12);
}

export function validateApiKeyFormat(key: string): boolean {
  return /^sk_(live|test)_[A-Za-z0-9_-]{20,}$/.test(key);
}

export function generateInvoiceId(): string {
  return `inv_${randomBytes(16).toString('base64url')}`;
}

export function generateWebhookId(): string {
  return `wh_${randomBytes(12).toString('base64url')}`;
}

export function getCurrentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getPeriodResetDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export function isTestKey(key: string): boolean {
  return key.startsWith('sk_test_');
}

export function safeJsonParse<T = unknown>(
  json: string | null | undefined,
  fallback: T,
): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    logger.warn({ json: json.slice(0, 100) }, 'Failed to parse JSON');
    return fallback;
  }
}
