import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { OcrResult } from './ocr.service.js';

export interface ExtractedInvoiceData {
  vendor_name: string;
  vendor_address?: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  currency: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  payment_ref?: string; // SwissQR reference
  lines: InvoiceLine[];
  raw_text?: string;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
  net: number;
}

const SYSTEM_PROMPT = `You are an expert at extracting structured data from Swiss invoices and QR-factures.

Extract the following fields from the invoice text and return ONLY valid JSON (no markdown, no explanation):
{
  "vendor_name": "Company name",
  "vendor_address": "Full address",
  "invoice_number": "Invoice number",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD or null",
  "currency": "CHF or EUR",
  "subtotal": 0.00,
  "vat_rate": 7.7,
  "vat_amount": 0.00,
  "total": 0.00,
  "payment_ref": "CHxx xxxx xxxx xxxx or null",
  "lines": [
    {
      "description": "Item description",
      "quantity": 1,
      "unit_price": 0.00,
      "net": 0.00
    }
  ]
}

Rules:
- Always use Swiss date format (YYYY-MM-DD)
- VAT rate is typically 7.7% for Switzerland
- Currency is CHF unless explicitly stated otherwise
- For QR-factures: extract the ESR/BESR reference from the payment section
- If a field is not found, use null for strings and 0 for numbers
- All amounts in the same currency as the invoice
- Return EXACT JSON — no markdown fences, no commentary`;

/**
 * GPT-4o-mini extraction service.
 * Uses OpenAI response_format for guaranteed JSON output.
 */
export class ExtractionService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
  }

  async extractFromOcr(ocrResult: OcrResult): Promise<{
    data: ExtractedInvoiceData;
    confidence: number;
  }> {
    if (!config.openaiApiKey) {
      logger.warn('OpenAI API key not configured — using mock extraction');
      return this.mockExtract(ocrResult);
    }

    try {
      const fullText = ocrResult.pages.map((p) => p.text).join('\n\n');

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2048,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Extract data from this invoice:\n\n${fullText}` },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const data = JSON.parse(raw) as ExtractedInvoiceData;

      // Estimate confidence based on how complete the data is
      const confidence = this.estimateConfidence(data);

      logger.info(
        { confidence, vendor: data.vendor_name },
        'Extraction completed',
      );

      return { data, confidence };
    } catch (err) {
      logger.error({ err }, 'OpenAI extraction failed');
      return this.mockExtract(ocrResult);
    }
  }

  private estimateConfidence(data: ExtractedInvoiceData): number {
    let score = 0.5;
    if (data.vendor_name && data.vendor_name !== 'null') score += 0.1;
    if (data.invoice_number) score += 0.1;
    if (data.invoice_date) score += 0.05;
    if (data.total > 0) score += 0.1;
    if (data.vat_rate > 0) score += 0.05;
    if (data.payment_ref) score += 0.05;
    if (data.lines.length > 0) score += 0.05;
    return Math.min(0.99, score);
  }

  private mockExtract(ocrResult: OcrResult): {
    data: ExtractedInvoiceData;
    confidence: number;
  } {
    // Mock data when API keys are not configured — for development only
    return {
      data: {
        vendor_name: 'Demo Vendor AG',
        vendor_address: 'Musterstrasse 1, 8000 Zürich',
        invoice_number: 'DEMO-001',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        currency: 'CHF',
        subtotal: 100.0,
        vat_rate: 7.7,
        vat_amount: 7.7,
        total: 107.7,
        payment_ref: undefined,
        lines: [
          {
            description: 'Professional services',
            quantity: 1,
            unit_price: 100.0,
            net: 100.0,
          },
        ],
        raw_text: ocrResult.text.slice(0, 500),
      },
      confidence: 0.75,
    };
  }
}

export const extractionService = new ExtractionService();
