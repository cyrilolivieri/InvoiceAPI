import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface OcrResult {
  text: string;
  pages: OcrPage[];
  language: string;
}

export interface OcrPage {
  pageNumber: number;
  text: string;
  markdown?: string;
}

/**
 * Mistral OCR API integration.
 * Falls back to raw text extraction if unavailable.
 */
export class MistralOcrService {
  private apiKey: string;
  private baseUrl = 'https://api.mistral.ai/v1/ocr';

  constructor() {
    this.apiKey = config.mistralApiKey;
  }

  async extractTextFromPDF(pdfBuffer: Buffer): Promise<OcrResult> {
    if (!this.apiKey) {
      logger.warn('Mistral API key not configured — using fallback extraction');
      return this.fallbackExtract(pdfBuffer);
    }

    try {
      const formData = new FormData();
      formData.append(
        'document',
        new Blob([pdfBuffer], { type: 'application/pdf' }),
        'invoice.pdf',
      );
      formData.append(
        'options',
        JSON.stringify({ renderMarkup: true, language: 'en' }),
      );

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error(
          { status: response.status, body: text },
          'Mistral OCR API error',
        );
        return this.fallbackExtract(pdfBuffer);
      }

      const data = (await response.json()) as {
        pages?: OcrPage[];
        text?: string;
        language?: string;
      };

      return {
        text: data.text ?? data.pages?.map((p) => p.text).join('\n') ?? '',
        pages: data.pages ?? [],
        language: data.language ?? 'unknown',
      };
    } catch (err) {
      logger.error({ err }, 'Mistral OCR request failed');
      return this.fallbackExtract(pdfBuffer);
    }
  }

  /**
   * Fallback: Extract raw text from PDF using basic parsing.
   * Does NOT replace OCR — only used when Mistral is unavailable.
   */
  private fallbackExtract(pdfBuffer: Buffer): OcrResult {
    // Simple text extraction from raw PDF bytes
    // This is a best-effort fallback — real OCR needs Mistral
    const text = pdfBuffer
      .toString('latin1')
      .replace(/[^\x20-\x7E\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000); // First 5k chars

    logger.info({ textLength: text.length }, 'Fallback text extraction used');

    return {
      text: text || 'No readable text found',
      pages: [{ pageNumber: 1, text: text || 'No readable text found' }],
      language: 'unknown',
    };
  }
}

export const mistralOcrService = new MistralOcrService();
