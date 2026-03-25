import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtractionService } from '../../src/services/extraction.service.js';
import type { OcrResult } from '../../src/services/ocr.service.js';

describe('ExtractionService', () => {
  let service: ExtractionService;

  beforeEach(() => {
    service = new ExtractionService();
  });

  describe('extractFromOcr', () => {
    it('should return mock data when API key is not configured', async () => {
      const ocrResult: OcrResult = {
        text: 'Test invoice content',
        pages: [{ pageNumber: 1, text: 'Test invoice content' }],
        language: 'en',
      };

      const result = await service.extractFromOcr(ocrResult);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.data).toHaveProperty('vendor_name');
      expect(result.data).toHaveProperty('invoice_number');
      expect(result.data).toHaveProperty('currency');
      expect(result.data).toHaveProperty('lines');
      expect(Array.isArray(result.data.lines)).toBe(true);
    });

    it('should use all page text in extraction', async () => {
      const ocrResult: OcrResult = {
        text: 'Page 1 text\n\nPage 2 text',
        pages: [
          { pageNumber: 1, text: 'Page 1 text' },
          { pageNumber: 2, text: 'Page 2 text' },
        ],
        language: 'en',
      };

      const result = await service.extractFromOcr(ocrResult);
      expect(result.data.raw_text).toContain('Page 1 text');
    });
  });
});
