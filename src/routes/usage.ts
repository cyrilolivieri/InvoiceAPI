import type { FastifyInstance } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkQuota } from '../services/auth.service.js';

export async function usageRouter(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;

      const quota = await checkQuota(user.userId, user.plan);

      return reply.send({
        plan: user.plan,
        used: quota.used,
        limit: quota.limit === Infinity ? 'unlimited' : quota.limit,
        remaining: quota.remaining === Infinity ? 'unlimited' : quota.remaining,
        reset_date: quota.resetDate.toISOString(),
        features: user.plan === 'enterprise'
          ? ['webhooks', 'batch_export', 'unlimited']
          : user.plan === 'pro'
          ? ['webhooks', 'batch_export']
          : ['basic_extraction'],
      });
    },
  );
}
