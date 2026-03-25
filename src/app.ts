import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { invoicesRouter } from './routes/invoices.js';
import { webhooksRouter } from './routes/webhooks.js';
import { usageRouter } from './routes/usage.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './utils/error-handler.js';

export async function buildApp() {
  const app = fastify({
    logger: logger,
    disableRequestLogging: false,
  });

  // ─── Plugins ───────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-API-Key',
      'X-Idempotency-Key',
    ],
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
      files: 1,
    },
  });

  // ─── Global middleware ────────────────────────────────────────────────────

  app.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const latencyMs = Date.now() - (request.startTime ?? Date.now());
    request.log.info({
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      latencyMs,
    });
  });

  // ─── Error handler ────────────────────────────────────────────────────────

  app.setErrorHandler(errorHandler);

  // ─── Routes ───────────────────────────────────────────────────────────────

  // Health — no auth
  await app.register(healthRouter);

  // Auth-gated routes
  await app.register(async (instance) => {
    instance.addHook('preHandler', authMiddleware);

    await instance.register(invoicesRouter, { prefix: '/v1/invoices' });
    await instance.register(webhooksRouter, { prefix: '/v1/webhooks' });
    await instance.register(usageRouter, { prefix: '/v1/usage' });
  });

  return app;
}

// Extend FastifyRequest type
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    user?: {
      userId: string;
      plan: 'starter' | 'pro' | 'enterprise';
      apiKeyId: string;
      scope: 'full' | 'read';
    };
  }
}
