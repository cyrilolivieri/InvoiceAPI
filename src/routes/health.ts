import type { FastifyInstance } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

export async function healthRouter(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      version: config.apiVersion,
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });
}
