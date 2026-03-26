# Sprint 2 — Deployment Report
**Date:** 2026-03-26
**Project:** InvoiceAPI
**Sprint:** 2 — Infrastructure & Deployment
**Status:** 🔄 PARTIALLY COMPLETE (blocked on credentials)

---

## ✅ Ce qui a été fait

### 1. CI/CD Workflow corrigé
- **Problème identifié:** L'ancien workflow utilisait `railway up --service invoiceapi` sans authentication préalable ni identification de projet/service
- **Fix appliqué:** Migration vers `railway-actions/railway@main` avec `projectId` + `serviceId`
- **Secrets requis dans GitHub:**
  - `RAILWAY_TOKEN` — Railway auth token
  - `RAILWAY_PROJECT_ID` — ID du projet Railway
  - `RAILWAY_SERVICE_ID` — ID du service Railway
  - `DATABASE_URL` — Neon PostgreSQL connection string
  - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis
  - `MISTRAL_API_KEY` — Mistral OCR
  - `OPENAI_API_KEY` — OpenAI extraction
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` — AWS S3 (optionnel)
- **Fichier:** `.github/workflows/ci.yml`

### 2. Railway Config mis à jour
- Fichier `railway.json` nettoyé (schema + config standard Railway v4)
- `railway.json` toujours compatible avec NIXPACKS (builder Node.js 22)

### 3. Tests validés (31/31 ✅)
```
Test Files  5 passed (5)
     Tests  31 passed (31)
```

---

## ⚠️ BLOQUÉ — Action requise d'Alan

### Étape 1 : Créer les comptes (1x uniquement)

| Service | Action requise | Lien |
|---------|----------------|------|
| **Neon PostgreSQL** | Créer projet gratuit + récupérer DATABASE_URL | https://neon.tech/ |
| **Upstash Redis** | Créer projet gratuit + récupérer URL + Token | https://upstash.com/ |
| **Railway** | Connecter repo GitHub + récupérer Project ID + Service ID | https://railway.app/ |

### Étape 2 : Configurer les secrets GitHub

Une fois les credentials obtenus, exécuter:

```bash
gh secret set RAILWAY_TOKEN --body "<token-from-railway-dashboard>"
gh secret set RAILWAY_PROJECT_ID --body "<project-id>"
gh secret set RAILWAY_SERVICE_ID --body "<service-id>"
gh secret set DATABASE_URL --body "<neon-connection-string>"
gh secret set UPSTASH_REDIS_REST_URL --body "<upstash-url>"
gh secret set UPSTASH_REDIS_REST_TOKEN --body "<upstash-token>"
gh secret set MISTRAL_API_KEY --body "<mistral-key>"
gh secret set OPENAI_API_KEY --body "<openai-key>"
# Optionnel (S3 pour stockage fichiers):
gh secret set AWS_ACCESS_KEY_ID --body "<aws-key>"
gh secret set AWS_SECRET_ACCESS_KEY --body "<aws-secret>"
gh secret set AWS_S3_BUCKET --body "invoiceapi-uploads"
```

### Étape 3 : Provisionner la DB (Neon)

Une fois `DATABASE_URL` obtenu:
```bash
cd /home/cyril/.openclaw/workspace-bmad-agent/invoiceapi/
# Configurer .env local pour migrations
cp .env.example .env
# Editer .env avec DATABASE_URL de Neon
npm run db:migrate
```

### Étape 4 : Connecter Railway au repo GitHub

1. Se rendre sur https://railway.app
2. New Project → "Deploy from GitHub repo"
3. Sélectionner `cyrilolivieri/InvoiceAPI`
4. Railway détecte `railway.json` → déploie automatiquement
5. Récupérer Project ID (dans URL du projet) et Service ID

### Étape 5 : Pusher les secrets + Merger

```bash
cd /home/cyril/.openclaw/workspace-bmad-agent/invoiceapi/
git add .github/workflows/ci.yml railway.json
git commit -m "fix: use railway-actions for CI/CD deployment"
git push origin main
# GitHub Actions déclenche automatiquement si tous les secrets sont configurés
```

---

## 📋 Checklist Déploiement Railway

### Phase A — Créer les services (Alan)

- [ ] Créer projet Neon PostgreSQL (tier gratuit)
- [ ] Copier `DATABASE_URL` (format: `postgresql://user:pass@host/db?sslmode=require`)
- [ ] Créer projet Upstash Redis (tier gratuit)
- [ ] Copier `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`
- [ ] Créer compte Railway et connecter le repo GitHub
- [ ] Récupérer `RAILWAY_TOKEN` depuis Railway Settings → Tokens
- [ ] Récupérer `RAILWAY_PROJECT_ID` et `RAILWAY_SERVICE_ID`

### Phase B — Configurer secrets GitHub (Alan)

- [ ] `gh secret set RAILWAY_TOKEN`
- [ ] `gh secret set RAILWAY_PROJECT_ID`
- [ ] `gh secret set RAILWAY_SERVICE_ID`
- [ ] `gh secret set DATABASE_URL`
- [ ] `gh secret set UPSTASH_REDIS_REST_URL`
- [ ] `gh secret set UPSTASH_REDIS_REST_TOKEN`
- [ ] `gh secret set MISTRAL_API_KEY`
- [ ] `gh secret set OPENAI_API_KEY`
- [ ] (Optionnel) Configurer secrets AWS

### Phase C — Migration DB (via Railway shell ou CI)

```bash
# Via Railway shell (après premier déploiement):
railway run npm run db:migrate
```

### Phase D — Tag version + Release

Après déploiement confirmé:
```bash
git tag v0.2.0
git push origin v0.2.0
```

---

## 🏗️ Architecture Railway

```
GitHub (main branch)
       │
       ▼ [CI/CD workflow]
GitHub Actions
  ├─ Test job (tsc, lint, vitest)
  └─ Deploy job (needs test)
        │
        ▼
  railway-actions/railway@main
        │
        ├── Variables: DATABASE_URL, UPSTASH_*, MISTRAL_API_KEY, OPENAI_API_KEY
        │
        ▼
  Railway Cloud (Node.js 22)
       ├─ Service: invoiceapi
       ├─ DB: Neon PostgreSQL (free tier)
       ├─ Cache: Upstash Redis (free tier)
       └─ Health: GET /health → 200 OK
```

---

## 🔑 Variables d'environnement attendues en prod

| Variable | Source | Format |
|----------|--------|--------|
| `NODE_ENV` | CI/CD | `production` |
| `PORT` | CI/CD | `3000` |
| `DATABASE_URL` | Neon | `postgresql://...neon.tech/...` |
| `UPSTASH_REDIS_REST_URL` | Upstash | `https://...upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | UUID-like token |
| `MISTRAL_API_KEY` | Mistral console | `...` |
| `OPENAI_API_KEY` | OpenAI platform | `sk-...` |
| `AWS_*` | AWS IAM | Optionnel (Sprint 3) |

---

## 🧪 Test fonctionnel attendu

Après déploiement:
```bash
# Health check
curl https://<railway-app-url>/health

# Test extraction (avec clé API mock en attendant)
curl -X POST https://<railway-app-url>/v1/invoices/extract \
  -H "X-API-Key: sk_test_mock123" \
  -F "file=@tests/fixtures/invoice.pdf"

# Vérifier rate limiting (Upstash)
curl -i https://<railway-app-url>/v1/usage \
  -H "X-API-Key: sk_test_mock123"
```

---

## 📁 Fichiers modifiés ce Sprint

| Fichier | Action |
|---------|--------|
| `.github/workflows/ci.yml` | Fix CI/CD (Railway GitHub Action) |
| `railway.json` | Cleaned + schema added |

---

## Budget (mis à jour Sprint 2)

| Poste | Coût estimé/mois | Status |
|-------|-----------------|--------|
| Railway (Hobby free) | 0 CHF | ✅ Free tier |
| Neon PostgreSQL | 0 CHF | ✅ Free tier |
| Upstash Redis | 0 CHF | ✅ Free tier |
| Mistral OCR | ~15 CHF/1000 invoices | ⚠️ À configurer |
| OpenAI | ~5 CHF/1000 invoices | ⚠️ À configurer |
| **Total si 1000 invoices/mois** | **~20 CHF/mois** | ✅ Dans budget |

---

## ⏭️ Prochaines étapes (Sprint 3)

1. Dashboard web (Next.js ou Astro)
2. Stripe intégration (paiements)
3. Webhook delivery avec retry HMAC
4. OpenAPI `/docs`
5. Load testing k6
6. S3 upload pour stockage fichiers
