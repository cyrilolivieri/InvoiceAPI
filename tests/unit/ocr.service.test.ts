import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MistralOcrService } from '../../src/services/ocr.service.js';

describe('MistralOcrService', () => {
  let service: MistralOcrService;

  beforeEach(() => {
    service = new MistralOcrService();
  });

  describe('extractTextFromPDF', () => {
    it('should use fallback when API key is not configured', async () => {
      // Service is initialized with empty key
      const result = await service.extractTextFromPDF(Buffer.from('%PDF-1.4 test content'));
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('pages');
      expect(result).toHaveProperty('language');
      expect(result.language).toBe('unknown');
    });

    it('should return pages array with at least one entry', async () => {
      const result = await service.extractTextFromPDF(Buffer.from('%PDF-1.4'));
      expect(Array.isArray(result.pages)).toBe(true);
      expect(result.pages.length).toBeGreaterThan(0);
    });
  });
});
