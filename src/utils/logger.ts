import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'invoiceapi',
    env: config.nodeEnv,
  },
});
