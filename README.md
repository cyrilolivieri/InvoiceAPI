# InvoiceAPI

> SaaS B2B API pour extraction automatique de données factures (Swiss QR-factures, OCR + LLM).

**Stack:** Node.js 22 · Fastify · TypeScript · Drizzle ORM · Neon PostgreSQL · Upstash Redis · Mistral OCR · GPT-4o-mini

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Run migrations
npm run db:migrate

# 4. Seed demo data
npx tsx scripts/seed.ts

# 5. Start dev server
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (no auth) |
| `POST` | `/v1/invoices/extract` | Upload PDF → extract data |
| `GET` | `/v1/invoices/:id` | Get invoice by ID |
| `GET` | `/v1/invoices` | List invoices (paginated) |
| `GET` | `/v1/invoices/export` | Export CSV/JSON |
| `DELETE` | `/v1/invoices/:id` | Delete invoice |
| `GET` | `/v1/usage` | Quota status |
| `POST` | `/v1/webhooks` | Create webhook |
| `GET` | `/v1/webhooks` | List webhooks |
| `DELETE` | `/v1/webhooks/:id` | Delete webhook |

## Authentication

```bash
curl -H "Authorization: Bearer sk_live_xxxx" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@invoice.pdf" \
     https://api.invoiceapi.ch/v1/invoices/extract
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis token |
| `MISTRAL_API_KEY` | ✅ | Mistral OCR API key |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `AWS_*` | Prod | AWS S3 credentials |

## Scripts

```bash
npm run dev          # Dev server (tsx watch)
npm run build        # TypeScript build
npm start            # Production server
npm test             # Run tests
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run db:migrate   # Run migrations
npm run db:studio    # Drizzle Studio
npm run seed         # Seed demo data
```

## Testing

```bash
npm test             # Unit tests (Vitest)
npm run test:coverage  # With coverage report
```

## Deployment (Railway)

1. Connect GitHub repo to Railway
2. Add environment variables in Railway dashboard
3. Deploy — Railway auto-detects Node.js 22

## Architecture

```
src/
├── routes/          # Fastify route handlers
├── services/        # Business logic (OCR, extraction, auth)
├── models/          # Drizzle schema + DB client
├── middleware/      # Auth middleware
└── utils/          # Logger, crypto, error handler
```

## Plans & Limits

| Plan | Monthly | RPM |
|------|---------|-----|
| Starter | 200 | 10 |
| Pro | 1000 | 30 |
| Enterprise | Unlimited | 100 |

## License

Proprietary — © 2026 InvoiceAPI
