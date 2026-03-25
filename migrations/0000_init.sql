-- InvoiceAPI Database Migration
-- Initial schema creation

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Primary',
    scope TEXT NOT NULL DEFAULT 'full' CHECK (scope IN ('full', 'read')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id),
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'extracted', 'failed')),
    filename TEXT,
    s3_key TEXT,
    file_size_bytes INTEGER,
    extracted_data TEXT,
    confidence NUMERIC(3,2),
    extract_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extracted_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- Usage table
CREATE TABLE IF NOT EXISTS usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    invoices_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_period ON usage(user_id, period_year, period_month);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret_hash TEXT,
    events TEXT[] NOT NULL DEFAULT ARRAY['invoice.extracted'],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);

-- Webhook deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    invoice_id UUID,
    event TEXT NOT NULL,
    payload TEXT,
    response_status INTEGER,
    attempt INTEGER NOT NULL DEFAULT 1,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);

-- API logs table
CREATE TABLE IF NOT EXISTS api_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID REFERENCES api_keys(id),
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER,
    latency_ms INTEGER,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_logs(api_key_id);
