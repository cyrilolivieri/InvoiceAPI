import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../src/utils/error-handler.js';

describe('AppError', () => {
  it('should create error with all properties', () => {
    const error = new AppError(404, 'not_found', 'Invoice not found', { id: '123' });
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe('not_found');
    expect(error.message).toBe('Invoice not found');
    expect(error.details).toEqual({ id: '123' });
    expect(error.name).toBe('AppError');
  });

  it('should be instanceof Error', () => {
    const error = new AppError(400, 'bad_request', 'Invalid input');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });
});
