# Sprint 1 Status Report

**Date:** 2026-03-25
**Project:** InvoiceAPI
**Sprint:** 1 — Core API + OCR
**Status:** ✅ COMPLETED

---

## Ce qui fonctionne

### ✅ Infrastructure & Setup
- [x] Project structure `src/{routes,services,models,middleware,utils}` + `tests/`
- [x] Node.js 22 + Fastify 5 + TypeScript (strict mode)
- [x] Drizzle ORM with Neon PostgreSQL schema
- [x] ESLint + Vitest configured
- [x] Railway deployment config (`railway.json`)
- [x] GitHub Actions CI/CD workflow
- [x] `scripts/seed.ts` for demo data

### ✅ Core API Endpoints
- [x] `GET /health` — Health check (no auth)
- [x] `POST /v1/invoices/extract` — Upload PDF → async extraction → 202 Accepted
- [x] `GET /v1/invoices/:id` — Retrieve extraction by ID
- [x] `GET /v1/invoices` — Paginated list with filters
- [x] `GET /v1/invoices/export` — Export CSV or JSON
- [x] `DELETE /v1/invoices/:id` — Soft delete
- [x] `GET /v1/usage` — Quota status per plan
- [x] `POST /v1/webhooks` — Create webhook
- [x] `GET /v1/webhooks` — List webhooks
- [x] `DELETE /v1/webhooks/:id` — Delete webhook

### ✅ Auth & Rate Limiting
- [x] SHA-256 API key hash in DB (key never stored in clear)
- [x] `sk_live_` / `sk_test_` prefix validation
- [x] Per-plan rate limiting via Upstash Redis (sliding window)
  - Starter: 10 RPM / 200/mo
  - Pro: 30 RPM / 1000/mo
  - Enterprise: 100 RPM / unlimited
- [x] Monthly quota tracking in `usage` table
- [x] HTTP 429 responses with upgrade URL

### ✅ OCR & Extraction
- [x] Mistral OCR API integration (with fallback)
- [x] GPT-4o-mini extraction with structured JSON output
- [x] SwissQR payment reference extraction
- [x] Mock extraction for dev (no API keys needed)
- [x] Confidence score estimation

### ✅ Database
- [x] Schema: users, api_keys, invoices, usage, webhooks, webhook_deliveries, api_logs
- [x] SQL migration file (`migrations/0000_init.sql`)
- [x] Drizzle ORM configured

### ✅ Tests
- [x] **31 tests passing** (5 test files)
  - Crypto utils (22 tests)
  - OCR service (2 tests)
  - Extraction service (2 tests)
  - Error handler (2 tests)
  - Schema constants (3 tests)

### ✅ Quality
- [x] `tsc --noEmit` → 0 errors
- [x] `npm run build` → success
- [x] Git initialized with initial commit

---

## Ce qui est en cours / non finalisé

### ⚠️ Nécessite credentials pour fonctionner en production
Les services suivants nécessitent des clés API pour être opérationnels :

| Service | Status | Clé requise |
|---------|--------|------------|
| Mistral OCR | ✅ Intégré (fallback OK) | `MISTRAL_API_KEY` |
| OpenAI GPT-4o-mini | ✅ Intégré (mock OK) | `OPENAI_API_KEY` |
| Upstash Redis | ✅ Intégré (disabled OK) | `UPSTASH_REDIS_REST_URL/TOKEN` |
| Neon PostgreSQL | ✅ Configuré | `DATABASE_URL` |
| AWS S3 | ⚠️ Non implémenté | `AWS_ACCESS_KEY_ID/SECRET` |

### 🔄 Non implémenté (Sprint 2-3)
- [ ] S3 upload pour stockage factures (Sprint 3)
- [ ] Webhook delivery avec retry HMAC (Sprint 2)
- [ ] Stripe intégration (Sprint 2)
- [ ] Dashboard web (Sprint 2)
- [ ] OpenAPI documentation `/docs` (Sprint 2)
- [ ] Load testing k6 (Sprint 3)
- [ ] Batch extraction (Sprint 3)
- [ ] Banana.ch / Sage export (Sprint 3)

---

## Blocages

| Blocage | Impact | Statut |
|---------|--------|--------|
| **Aucune clé API Mistral configurée** | OCR fonctionne en mode fallback (texte brut) | ⚠️ OK pour dev |
| **Aucune clé API OpenAI configurée** | Extraction fonctionne en mode mock | ⚠️ OK pour dev |
| **Neon PostgreSQL non créé** | BDD non provisionnée | ⚠️ Action requise |
| **Upstash Redis non créé** | Rate limiting désactivé | ⚠️ Acceptable (fail-open) |

### 🔑 Clés API nécessaires pour déploiement
```
MISTRAL_API_KEY       → https://console.mistral.ai/
OPENAI_API_KEY        → https://platform.openai.com/api-keys
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN → https://upstash.com/
DATABASE_URL          → https://neon.tech/ (créer projet)
```

---

## Prochaines étapes

1. **Setup credentials** — Créer comptes Neon, Upstash, Mistral, OpenAI
2. **Provisionner Neon DB** — Copier `DATABASE_URL` dans Railway vars
3. **Run migrations** — `npm run db:migrate`
4. **Seed demo data** — `npx tsx scripts/seed.ts`
5. **Déployer Railway** — Connecter repo GitHub, ajouter env vars
6. **Tester `/v1/invoices/extract`** — Avec un vrai PDF de facture suisse

---

## Déploiement Railway — Checklist

```
Variables d'environnement à configurer:
□ NODE_ENV = production
□ DATABASE_URL = postgresql://...  (Neon)
□ UPSTASH_REDIS_REST_URL = https://...
□ UPSTASH_REDIS_REST_TOKEN = ...
□ MISTRAL_API_KEY = ...
□ OPENAI_API_KEY = ...
□ AWS_ACCESS_KEY_ID = ...
□ AWS_SECRET_ACCESS_KEY = ...
□ AWS_S3_BUCKET = invoiceapi-uploads
□ CORS_ORIGINS = https://invoiceapi.ch (prod)
```

---

## Fichiers livrés

| Fichier | Description |
|---------|-------------|
| `src/index.ts` | Entry point |
| `src/app.ts` | Fastify app builder |
| `src/config.ts` | Environment config |
| `src/models/schema.ts` | Drizzle schema + types |
| `src/models/db.ts` | Database client |
| `src/services/auth.service.ts` | API key validation |
| `src/services/ocr.service.ts` | Mistral OCR |
| `src/services/extraction.service.ts` | GPT-4o-mini extraction |
| `src/services/invoice.service.ts` | Invoice CRUD + processing |
| `src/services/ratelimit.service.ts` | Upstash Redis rate limiting |
| `src/middleware/auth.ts` | Auth middleware |
| `src/routes/invoices.ts` | Invoice endpoints |
| `src/routes/webhooks.ts` | Webhook endpoints |
| `src/routes/usage.ts` | Usage endpoint |
| `src/routes/health.ts` | Health check |
| `src/utils/*.ts` | Logger, crypto, error handler |
| `tests/unit/*.test.ts` | 31 unit tests |
| `migrations/0000_init.sql` | SQL migration |
| `.github/workflows/ci.yml` | GitHub Actions CI/CD |
| `railway.json` | Railway deployment config |
| `scripts/seed.ts` | Demo data seeder |

---

## Budget

| Poste | Estimé | Statut |
|-------|--------|--------|
| Infrastructure (Railway) | ~50 CHF/mois | ✅ dans budget |
| Mistral OCR | ~15 CHF/mois (1000 invoices) | ✅ dans budget |
| OpenAI | ~5 CHF/mois (1000 invoices) | ✅ dans budget |
| Neon PostgreSQL | ~20 CHF/mois | ✅ dans budget |
| Upstash Redis | ~10 CHF/mois | ✅ dans budget |
| **Total estimé** | **~100 CHF/mois** | ✅ OK |

**Aucune clé API配置née — pas de dépassement prévisible pour l'instant.**
