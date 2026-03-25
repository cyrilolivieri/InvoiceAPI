import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    logger.info(
      `InvoiceAPI running on http://0.0.0.0:${config.port} [${config.nodeEnv}]`,
    );
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
