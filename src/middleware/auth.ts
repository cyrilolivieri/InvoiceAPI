import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateApiKey } from '../services/auth.service.js';
import { checkRateLimit, enforceQuotaHeaders, assertQuotaAllowed } from '../services/ratelimit.service.js';
import { AppError } from '../utils/error-handler.js';

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // Extract API key from Authorization header or X-API-Key header
  const authHeader = request.headers.authorization ?? request.headers['x-api-key'];
  const rawKey = Array.isArray(authHeader) ? authHeader[0] ?? '' : authHeader ?? '';

  if (!rawKey) {
    throw new AppError(401, 'missing_api_key', 'API key is required');
  }

  // Validate key
  const authResult = await validateApiKey(rawKey);
  if (!authResult) {
    throw new AppError(401, 'invalid_api_key', 'Invalid or inactive API key');
  }

  request.user = {
    userId: authResult.userId,
    plan: authResult.plan,
    apiKeyId: authResult.apiKeyId,
    scope: authResult.scope,
  };

  // Check monthly quota (skip for test keys)
  if (!authResult.isTestKey) {
    const { checkQuota } = await import('../services/auth.service.js');
    const quota = await checkQuota(authResult.userId, authResult.plan);
    assertQuotaAllowed(quota.allowed, authResult.plan, quota.used, quota.limit);

    // Add quota headers
    const rateLimitResult = await checkRateLimit(
      authResult.apiKeyId,
      authResult.plan,
    );
    assertQuotaAllowed(
      rateLimitResult.allowed,
      authResult.plan,
      0,
      rateLimitResult.limit,
    );

    const headers = enforceQuotaHeaders(
      quota.used,
      quota.limit,
      quota.remaining,
      rateLimitResult.resetMs,
    );
    // Add headers via reply — we need to use reply.header in the response hook
    request.server.addHook('onSend', async (_req, reply) => {
      for (const [key, value] of Object.entries(headers)) {
        reply.header(key, value);
      }
    });
  }
}
