import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan', ['starter', 'pro', 'enterprise']);
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'processing',
  'extracted',
  'failed',
]);
export const apiKeyScopeEnum = pgEnum('api_key_scope', ['full', 'read']);

// ─── Tables ─────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  plan: planEnum('plan').notNull().default('starter'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: text('key_prefix').notNull(),
    name: text('name').notNull().default('Primary'),
    scope: apiKeyScopeEnum('scope').notNull().default('full'),
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_api_keys_hash').on(table.keyHash)],
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
    status: invoiceStatusEnum('status').notNull().default('processing'),
    filename: text('filename'),
    s3Key: text('s3_key'),
    fileSizeBytes: integer('file_size_bytes'),
    extractedData: text('extracted_data'), // JSONB stored as text
    confidence: numeric('confidence', { precision: 3, scale: 2 }),
    extractError: text('extract_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    extractedAt: timestamp('extracted_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_invoices_user_id').on(table.userId),
    index('idx_invoices_status').on(table.status),
    index('idx_invoices_created').on(table.createdAt),
  ],
);

export const usage = pgTable(
  'usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodYear: integer('period_year').notNull(),
    periodMonth: integer('period_month').notNull(),
    invoicesCount: integer('invoices_count').notNull().default(0),
  },
  (table) => [
    uniqueIndex('idx_usage_user_period').on(
      table.userId,
      table.periodYear,
      table.periodMonth,
    ),
  ],
);

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secretHash: text('secret_hash'),
    events: text('events').array().notNull().default(['invoice.extracted']),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_webhooks_user_id').on(table.userId)],
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id'),
    event: text('event').notNull(),
    payload: text('payload'), // JSONB as text
    responseStatus: integer('response_status'),
    attempt: integer('attempt').notNull().default(1),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_webhook_deliveries_webhook').on(table.webhookId)],
);

export const apiLogs = pgTable(
  'api_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
    method: text('method').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code'),
    latencyMs: integer('latency_ms'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_api_logs_created').on(table.createdAt),
    index('idx_api_logs_key').on(table.apiKeyId),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  invoices: many(invoices),
  usage: many(usage),
  webhooks: many(webhooks),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  apiKey: one(apiKeys, {
    fields: [invoices.apiKeyId],
    references: [apiKeys.id],
  }),
}));

export const usageRelations = relations(usage, ({ one }) => ({
  user: one(users, { fields: [usage.userId], references: [users.id] }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  user: one(users, { fields: [webhooks.userId], references: [users.id] }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    webhook: one(webhooks, {
      fields: [webhookDeliveries.webhookId],
      references: [webhooks.id],
    }),
  }),
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Usage = typeof usage.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type ApiLog = typeof apiLogs.$inferSelect;

export type Plan = 'starter' | 'pro' | 'enterprise';
export type InvoiceStatus = 'processing' | 'extracted' | 'failed';
export type ApiKeyScope = 'full' | 'read';

// ─── Plan Limits ─────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<Plan, number> = {
  starter: 200,
  pro: 1000,
  enterprise: Infinity,
};

export const PLAN_RATE_LIMITS: Record<Plan, number> = {
  starter: 10,
  pro: 30,
  enterprise: 100,
};
