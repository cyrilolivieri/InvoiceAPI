import { db } from '../models/db.js';
import { invoices, usage } from '../models/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { mistralOcrService } from './ocr.service.js';
import { extractionService } from './extraction.service.js';
import { logger } from '../utils/logger.js';
import {
  generateInvoiceId,
  getCurrentPeriod,
} from '../utils/crypto.js';
import type { ExtractedInvoiceData } from './extraction.service.js';
import type { InvoiceStatus } from '../models/schema.js';

export interface CreateInvoiceResult {
  invoiceId: string;
  status: InvoiceStatus;
  createdAt: Date;
}

export interface InvoiceResult {
  id: string;
  userId: string;
  status: InvoiceStatus;
  filename: string | null;
  fileSizeBytes: number | null;
  extractedData: ExtractedInvoiceData | null;
  confidence: number | null;
  extractError: string | null;
  createdAt: Date;
  extractedAt: Date | null;
}

export async function createInvoice(params: {
  userId: string;
  apiKeyId: string;
  filename: string;
  s3Key?: string;
  fileSizeBytes?: number;
}): Promise<CreateInvoiceResult> {
  const invoiceId = generateInvoiceId();

  const [record] = await db
    .insert(invoices)
    .values({
      id: invoiceId,
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      filename: params.filename,
      s3Key: params.s3Key,
      fileSizeBytes: params.fileSizeBytes,
      status: 'processing',
    })
    .returning({ id: invoices.id, createdAt: invoices.createdAt });

  return {
    invoiceId: record.id,
    status: 'processing',
    createdAt: record.createdAt,
  };
}

export async function getInvoice(
  invoiceId: string,
  userId: string,
): Promise<InvoiceResult | null> {
  const record = await db.query.invoices.findFirst({
    where: (inv, { and, eq, isNull }) =>
      and(eq(inv.id, invoiceId), eq(inv.userId, userId), isNull(inv.deletedAt)),
  });

  if (!record) return null;

  return {
    id: record.id,
    userId: record.userId,
    status: record.status as InvoiceStatus,
    filename: record.filename,
    fileSizeBytes: record.fileSizeBytes ?? null,
    extractedData: record.extractedData
      ? (JSON.parse(record.extractedData) as ExtractedInvoiceData)
      : null,
    confidence: record.confidence ? parseFloat(String(record.confidence)) : null,
    extractError: record.extractError ?? null,
    createdAt: record.createdAt,
    extractedAt: record.extractedAt ?? null,
  };
}

export async function listInvoices(params: {
  userId: string;
  page: number;
  limit: number;
  status?: InvoiceStatus;
  fromDate?: string;
  toDate?: string;
  vendor?: string;
}): Promise<{ data: InvoiceResult[]; total: number }> {
  const { userId, page, limit, status, fromDate } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(invoices.userId, userId)];

  if (status) conditions.push(eq(invoices.status, status));
  if (fromDate) {
    conditions.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(invoices.createdAt, new Date(fromDate) as any),
    );
  }

  const [records, countResult] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: invoices.id })
      .from(invoices)
      .where(and(...conditions)),
  ]);

  return {
    data: records.map((r) => ({
      id: r.id,
      userId: r.userId,
      status: r.status as InvoiceStatus,
      filename: r.filename,
      fileSizeBytes: r.fileSizeBytes ?? null,
      extractedData: r.extractedData
        ? (JSON.parse(r.extractedData) as ExtractedInvoiceData)
        : null,
      confidence: r.confidence ? parseFloat(String(r.confidence)) : null,
      extractError: r.extractError ?? null,
      createdAt: r.createdAt,
      extractedAt: r.extractedAt ?? null,
    })),
    total: countResult.length,
  };
}

export async function deleteInvoice(
  invoiceId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(invoices)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.userId, userId),
      ),
    )
    .returning({ id: invoices.id });

  return result.length > 0;
}

export async function processExtraction(
  invoiceId: string,
  userId: string,
  pdfBuffer: Buffer,
): Promise<void> {
  logger.info({ invoiceId }, 'Starting extraction');

  try {
    // 1. OCR
    const ocrResult = await mistralOcrService.extractTextFromPDF(pdfBuffer);

    // 2. LLM Extraction
    const { data, confidence } = await extractionService.extractFromOcr(ocrResult);

    // 3. Store result
    await db
      .update(invoices)
      .set({
        status: 'extracted',
        extractedData: JSON.stringify(data),
        confidence: String(confidence),
        extractedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    // 4. Increment usage counter
    const { year, month } = getCurrentPeriod();
    await db
      .insert(usage)
      .values({
        userId,
        periodYear: year,
        periodMonth: month,
        invoicesCount: 1,
      })
      .onConflictDoUpdate({
        target: [usage.userId, usage.periodYear, usage.periodMonth],
        set: {
          invoicesCount: sql`${usage.invoicesCount} + 1`,
        },
      });

    logger.info({ invoiceId, confidence, vendor: data.vendor_name }, 'Extraction complete');
  } catch (err) {
    logger.error({ err, invoiceId }, 'Extraction failed');
    await db
      .update(invoices)
      .set({
        status: 'failed',
        extractError: err instanceof Error ? err.message : 'Unknown error',
        extractedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
  }
}
