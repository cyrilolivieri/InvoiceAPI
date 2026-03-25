import type { FastifyInstance } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../models/db.js';
import { webhooks } from '../models/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateWebhookId } from '../utils/crypto.js';
import { createHash } from 'crypto';

export async function webhooksRouter(app: FastifyInstance): Promise<void> {
  // ─── POST / ────────────────────────────────────────────────────────────────
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const body = request.body as Record<string, unknown>;

    const url = typeof body.url === 'string' ? body.url : null;
    const events = Array.isArray(body.events) ? body.events : ['invoice.extracted'];
    const secret = typeof body.secret === 'string' ? body.secret : null;

    if (!url || !url.startsWith('https://')) {
      return reply.status(400).send({
        error: 'invalid_url',
        message: 'A valid HTTPS URL is required',
      });
    }

    const webhookId = generateWebhookId();
    const secretHash = secret ? createHash('sha256').update(secret).digest('hex') : null;

    await db.insert(webhooks).values({
      id: webhookId,
      userId: user.userId,
      url,
      secretHash,
      events: events as string[],
      isActive: true,
    });

    return reply.status(201).send({
      webhook_id: webhookId,
      status: 'active',
    });
  });

  // ─── GET / ─────────────────────────────────────────────────────────────────
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    const records = await db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        isActive: webhooks.isActive,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(and(eq(webhooks.userId, user.userId), eq(webhooks.isActive, true)));

    return reply.send({
      data: records.map((r) => ({
        webhook_id: r.id,
        url: r.url,
        events: r.events,
        is_active: r.isActive,
        created_at: r.createdAt.toISOString(),
      })),
    });
  });

  // ─── DELETE /:id ───────────────────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = request.user!;
      const { id } = request.params;

      const result = await db
        .update(webhooks)
        .set({ isActive: false })
        .where(
          and(eq(webhooks.id, id), eq(webhooks.userId, user.userId)),
        )
        .returning({ id: webhooks.id });

      if (result.length === 0) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Webhook not found',
        });
      }

      return reply.status(204).send();
    },
  );
}
