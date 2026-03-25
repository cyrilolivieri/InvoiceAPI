import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { config } from '../config.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

type AppErrorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) => void;

export const errorHandler: AppErrorHandler = (error, request, reply) => {
  request.log.error({ err: error, url: request.url, method: request.method });

  // Zod validation errors
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: 'validation_error',
      message: 'Request validation failed',
      details: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // App-level errors
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: error.errorCode,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  // Fastify validation errors (e.g., multipart)
  if (error.validation) {
    reply.status(400).send({
      error: 'validation_error',
      message: error.message,
      details: error.validation,
    });
    return;
  }

  // Default — internal server error
  const statusCode = error.statusCode ?? 500;
  reply.status(statusCode).send({
    error: statusCode >= 500 ? 'internal_error' : 'request_error',
    message:
      statusCode >= 500 && config.nodeEnv === 'production'
        ? 'Internal server error'
        : error.message,
  });
};
