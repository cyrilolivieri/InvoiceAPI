import { describe, it, expect } from 'vitest';
import {
  PLAN_LIMITS,
  PLAN_RATE_LIMITS,
} from '../../src/models/schema.js';

describe('Schema Constants', () => {
  describe('PLAN_LIMITS', () => {
    it('should have correct limits per plan', () => {
      expect(PLAN_LIMITS.starter).toBe(200);
      expect(PLAN_LIMITS.pro).toBe(1000);
      expect(PLAN_LIMITS.enterprise).toBe(Infinity);
    });
  });

  describe('PLAN_RATE_LIMITS', () => {
    it('should have increasing limits per tier', () => {
      expect(PLAN_RATE_LIMITS.starter).toBeLessThan(PLAN_RATE_LIMITS.pro);
      expect(PLAN_RATE_LIMITS.pro).toBeLessThan(PLAN_RATE_LIMITS.enterprise);
    });

    it('should have reasonable RPM values', () => {
      expect(PLAN_RATE_LIMITS.starter).toBeGreaterThanOrEqual(10);
      expect(PLAN_RATE_LIMITS.pro).toBeGreaterThanOrEqual(30);
      expect(PLAN_RATE_LIMITS.enterprise).toBeGreaterThanOrEqual(100);
    });
  });
});
