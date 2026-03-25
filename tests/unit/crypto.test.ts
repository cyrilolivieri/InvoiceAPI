import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
  validateApiKeyFormat,
  generateInvoiceId,
  generateWebhookId,
  getCurrentPeriod,
  getPeriodResetDate,
  isTestKey,
  safeJsonParse,
} from '../../src/utils/crypto.js';

describe('Crypto Utils', () => {
  describe('generateApiKey', () => {
    it('should generate a key with sk_live prefix by default', () => {
      const key = generateApiKey();
      expect(key.startsWith('sk_live_')).toBe(true);
    });

    it('should generate a key with sk_test prefix', () => {
      const key = generateApiKey('sk_test');
      expect(key.startsWith('sk_test_')).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });

    it('should generate a key of sufficient length', () => {
      const key = generateApiKey();
      expect(key.length).toBeGreaterThan(30);
    });
  });

  describe('hashApiKey', () => {
    it('should produce consistent hash for same input', () => {
      const key = 'sk_live_testkey123';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = hashApiKey('key1');
      const hash2 = hashApiKey('key2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-char hex string (SHA-256)', () => {
      const hash = hashApiKey('any_key');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('should accept valid sk_live keys', () => {
      const key = 'sk_test_REDACTED_BY_ATLAS_00000000';
      expect(validateApiKeyFormat(key)).toBe(true);
    });

    it('should accept valid sk_test keys', () => {
      const key = 'sk_test_xf3k9q2mAbCdEfGhIjKlMnOpQrS';
      expect(validateApiKeyFormat(key)).toBe(true);
    });

    it('should reject empty string', () => {
      expect(validateApiKeyFormat('')).toBe(false);
    });

    it('should reject invalid prefix', () => {
      expect(validateApiKeyFormat('pk_live_xxx')).toBe(false);
    });

    it('should reject too short keys', () => {
      expect(validateApiKeyFormat('sk_live_xxx')).toBe(false);
    });
  });

  describe('generateInvoiceId', () => {
    it('should generate ID with inv_ prefix', () => {
      const id = generateInvoiceId();
      expect(id.startsWith('inv_')).toBe(true);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateInvoiceId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateWebhookId', () => {
    it('should generate ID with wh_ prefix', () => {
      const id = generateWebhookId();
      expect(id.startsWith('wh_')).toBe(true);
    });
  });

  describe('getCurrentPeriod', () => {
    it('should return current year and month', () => {
      const { year, month } = getCurrentPeriod();
      expect(year).toBeGreaterThan(2025);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    });
  });

  describe('getPeriodResetDate', () => {
    it('should return first day of next month', () => {
      const reset = getPeriodResetDate();
      const now = new Date();
      const expectedMonth = now.getMonth() + 2; // next month
      const expectedYear = now.getFullYear() + (expectedMonth > 12 ? 1 : 0);
      const normalizedMonth = ((expectedMonth - 1) % 12) + 1;
      expect(reset.getDate()).toBe(1);
    });
  });

  describe('isTestKey', () => {
    it('should return true for sk_test keys', () => {
      expect(isTestKey('sk_test_xxx')).toBe(true);
    });

    it('should return false for sk_live keys', () => {
      expect(isTestKey('sk_live_xxx')).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key":"value"}', null);
      expect(result).toEqual({ key: 'value' });
    });

    it('should return fallback for null', () => {
      const fallback = { key: 'fallback' };
      expect(safeJsonParse(null, fallback)).toBe(fallback);
    });

    it('should return fallback for invalid JSON', () => {
      const fallback = { key: 'fallback' };
      expect(safeJsonParse('not json', fallback)).toBe(fallback);
    });
  });
});
