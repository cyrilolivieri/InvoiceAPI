import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// ─── Schema definitions ──────────────────────────────────────────────────────

export const extractBodySchema = z.object({
  file_data: z.string().base64().optional(),
  filename: z.string().optional(),
  options: z
    .object({
      lang: z.enum(['fr', 'de', 'it', 'en']).optional(),
      strict_vat: z.boolean().optional(),
    })
    .optional(),
});

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['processing', 'extracted', 'failed']).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vendor: z.string().optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('json'),
  from_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ExtractBody = z.infer<typeof extractBodySchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;

// ─── Router ──────────────────────────────────────────────────────────────────

export async function invoicesRouter(app: FastifyInstance): Promise<void> {
  // ─── POST /extract ────────────────────────────────────────────────────────
  app.post('/extract', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    // Support both multipart and base64 JSON
    let pdfBuffer: Buffer;
    let filename = 'invoice.pdf';

    if (request.isMultipart()) {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({
          error: 'invalid_file',
          message: 'No file uploaded',
        });
      }

      // Validate PDF magic bytes
      const fileBuffer = await file.toBuffer();
      const header = fileBuffer.slice(0, 5).toString('hex');
      if (!header.startsWith('25504446')) {
        // %PDF
        return reply.status(400).send({
          error: 'invalid_file',
          message: 'File must be a valid PDF',
        });
      }

      if (fileBuffer.length > 20 * 1024 * 1024) {
        return reply.status(400).send({
          error: 'invalid_file',
          message: 'File must be under 20MB',
        });
      }

      pdfBuffer = fileBuffer;
      filename = file.filename ?? filename;
    } else {
      // JSON body with base64 PDF
      const body = await request.body as Record<string, unknown>;
      const parsed = extractBodySchema.safeParse(body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      if (!parsed.data.file_data) {
        return reply.status(400).send({
          error: 'missing_file',
          message: 'file_data (base64) is required',
        });
      }

      pdfBuffer = Buffer.from(parsed.data.file_data, 'base64');
      filename = parsed.data.filename ?? filename;
    }

    // Queue extraction (async for large files)
    const { createInvoice, processExtraction } = await import(
      '../services/invoice.service.js'
    );

    const invoice = await createInvoice({
      userId: user.userId,
      apiKeyId: user.apiKeyId,
      filename,
      fileSizeBytes: pdfBuffer.length,
    });

    // Process async (non-blocking)
    processExtraction(invoice.invoiceId, user.userId, pdfBuffer).catch(
      (err) =>
        request.log.error({ err, invoiceId: invoice.invoiceId }, 'Async extraction error'),
    );

    return reply.status(202).send({
      invoice_id: invoice.invoiceId,
      status: 'processing',
      created_at: invoice.createdAt.toISOString(),
    });
  });

  // ─── GET /:id ──────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user!;

      const { getInvoice } = await import('../services/invoice.service.js');
      const invoice = await getInvoice(id, user.userId);

      if (!invoice) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Invoice not found',
        });
      }

      return reply.send({
        invoice_id: invoice.id,
        status: invoice.status,
        vendor_name: invoice.extractedData?.vendor_name,
        vendor_address: invoice.extractedData?.vendor_address,
        invoice_number: invoice.extractedData?.invoice_number,
        invoice_date: invoice.extractedData?.invoice_date,
        due_date: invoice.extractedData?.due_date,
        currency: invoice.extractedData?.currency,
        subtotal: invoice.extractedData?.subtotal,
        vat_rate: invoice.extractedData?.vat_rate,
        vat_amount: invoice.extractedData?.vat_amount,
        total: invoice.extractedData?.total,
        payment_ref: invoice.extractedData?.payment_ref,
        lines: invoice.extractedData?.lines,
        confidence: invoice.confidence,
        filename: invoice.filename,
        extract_error: invoice.extractError,
        created_at: invoice.createdAt.toISOString(),
        extracted_at: invoice.extractedAt?.toISOString() ?? null,
      });
    },
  );

  // ─── GET / ─────────────────────────────────────────────────────────────────
  app.get(
    '/',
    async (request: FastifyRequest<{ Querystring: ListInvoicesQuery }>, reply: FastifyReply) => {
      const user = request.user!;
      const query = listInvoicesQuerySchema.parse(request.query);

      const { listInvoices } = await import('../services/invoice.service.js');
      const { data, total } = await listInvoices({
        userId: user.userId,
        page: query.page,
        limit: query.limit,
        status: query.status,
        fromDate: query.from_date,
        toDate: query.to_date,
        vendor: query.vendor,
      });

      return reply.send({
        data: data.map((inv) => ({
          invoice_id: inv.id,
          status: inv.status,
          vendor_name: inv.extractedData?.vendor_name,
          invoice_date: inv.extractedData?.invoice_date,
          total: inv.extractedData?.total,
          confidence: inv.confidence,
          created_at: inv.createdAt.toISOString(),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      });
    },
  );

  // ─── GET /export ───────────────────────────────────────────────────────────
  app.get<{ Querystring: ExportQuery }>(
    '/export',
    async (request: FastifyRequest<{ Querystring: ExportQuery }>, reply: FastifyReply) => {
      const user = request.user!;
      const query = exportQuerySchema.parse(request.query);

      const { listInvoices } = await import('../services/invoice.service.js');
      const { data } = await listInvoices({
        userId: user.userId,
        page: 1,
        limit: Math.min(query.limit, 500),
        fromDate: query.date_from,
        toDate: query.date_to,
      });

      if (query.format === 'csv') {
        const headers = [
          'Invoice ID',
          'Vendor',
          'Invoice Number',
          'Date',
          'Net',
          'VAT Rate',
          'VAT Amount',
          'Total',
          'Currency',
          'Payment Ref',
          'Confidence',
        ];
        const rows = data.map((inv) => [
          inv.id,
          inv.extractedData?.vendor_name ?? '',
          inv.extractedData?.invoice_number ?? '',
          inv.extractedData?.invoice_date ?? '',
          inv.extractedData?.subtotal ?? 0,
          inv.extractedData?.vat_rate ?? 0,
          inv.extractedData?.vat_amount ?? 0,
          inv.extractedData?.total ?? 0,
          inv.extractedData?.currency ?? 'CHF',
          inv.extractedData?.payment_ref ?? '',
          inv.confidence ?? 0,
        ]);

        const csv = [
          headers.join(','),
          ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
        ].join('\n');

        reply.header('Content-Type', 'text/csv');
        reply.header(
          'Content-Disposition',
          `attachment; filename=invoices_export_${new Date().toISOString().split('T')[0]}.csv`,
        );
        return reply.send(csv);
      }

      // JSON export
      return reply.send({
        exported_at: new Date().toISOString(),
        count: data.length,
        invoices: data.map((inv) => ({
          invoice_id: inv.id,
          status: inv.status,
          vendor_name: inv.extractedData?.vendor_name,
          vendor_address: inv.extractedData?.vendor_address,
          invoice_number: inv.extractedData?.invoice_number,
          invoice_date: inv.extractedData?.invoice_date,
          due_date: inv.extractedData?.due_date,
          currency: inv.extractedData?.currency,
          subtotal: inv.extractedData?.subtotal,
          vat_rate: inv.extractedData?.vat_rate,
          vat_amount: inv.extractedData?.vat_amount,
          total: inv.extractedData?.total,
          payment_ref: inv.extractedData?.payment_ref,
          lines: inv.extractedData?.lines,
          confidence: inv.confidence,
          created_at: inv.createdAt.toISOString(),
          extracted_at: inv.extractedAt?.toISOString() ?? null,
        })),
      });
    },
  );

  // ─── DELETE /:id ───────────────────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user!;

      const { deleteInvoice } = await import('../services/invoice.service.js');
      const deleted = await deleteInvoice(id, user.userId);

      if (!deleted) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Invoice not found',
        });
      }

      return reply.status(204).send();
    },
  );
}
