export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  // Database
  databaseUrl: process.env.DATABASE_URL ?? '',

  // Upstash Redis
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL ?? '',
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',

  // Mistral OCR
  mistralApiKey: process.env.MISTRAL_API_KEY ?? '',

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',

  // AWS S3
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  awsRegion: process.env.AWS_REGION ?? 'eu-central-1',
  awsS3Bucket: process.env.AWS_S3_BUCKET ?? 'invoiceapi-uploads',

  // Plans
  starterMonthlyLimit: parseInt(process.env.STARTER_MONTHLY_LIMIT ?? '200', 10),
  proMonthlyLimit: parseInt(process.env.PRO_MONTHLY_LIMIT ?? '1000', 10),

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),

  // Sentry
  sentryDsn: process.env.SENTRY_DSN ?? '',

  // Application
  apiVersion: '1.0.0',
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
} as const;

export type Config = typeof config;
