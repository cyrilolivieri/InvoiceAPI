#!/usr/bin/env bash
# InvoiceAPI — Local Development Setup
# One-command bootstrap: docker-compose up + migrations + seed
#
# Usage:
#   ./scripts/setup-local.sh          # foreground (see logs)
#   ./scripts/setup-local.sh --detach # background (detached)
#
# Prerequisites:
#   - Docker & Docker Compose installed
#   - Ports 3000, 5432, 6379, 5000 available

set -e

DETACH=""
if [[ "${1:-}" == "--detach" || "${1:-}" == "-d" ]]; then
  DETACH="yes"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " InvoiceAPI — Local Development Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Check Docker
if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found. Install Docker first: https://docs.docker.com/get-docker/"
  exit 1
fi
if ! docker info &>/dev/null; then
  echo "❌ Docker daemon not running. Start Docker and try again."
  exit 1
fi
echo "✅ Docker available"

# 2. Create .env from .env.example if missing
if [[ ! -f .env ]]; then
  echo "📄 Creating .env from .env.example..."
  cp .env.example .env
  echo "✅ .env created — review and adjust values if needed"
else
  echo "✅ .env already exists"
fi

# 3. Build & start all services
echo ""
echo "🚀 Starting services (PostgreSQL, Redis, PaddleOCR, InvoiceAPI)..."
if [[ -n "$DETACH" ]]; then
  docker-compose up --build --detach
  echo "✅ Services started in background"
  echo "   View logs: docker-compose logs -f app"
else
  docker-compose up --build
  exit 0
fi

# 4. Wait for app to be healthy
echo ""
echo "⏳ Waiting for InvoiceAPI to be healthy..."
MAX_WAIT=90
INTERVAL=5
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  if docker-compose exec -T app wget -qO- http://localhost:3000/health &>/dev/null; then
    echo "✅ InvoiceAPI is healthy"
    break
  fi
  echo "   Still starting... (${ELAPSED}s / ${MAX_WAIT}s)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
  echo "⚠️  InvoiceAPI health check timed out. Check: docker-compose logs app"
fi

# 5. Run migrations
echo ""
echo "🔄 Running database migrations..."
if docker-compose exec -T app npx drizzle-kit migrate --force 2>&1; then
  echo "✅ Migrations applied"
else
  # Non-fatal: might already be up to date
  echo "⚠️  Migration step finished (check output above for errors)"
fi

# 6. Seed demo data
echo ""
echo "🌱 Seeding database..."
if docker-compose exec -T app npx tsx scripts/seed.ts 2>&1; then
  echo "✅ Seed complete"
else
  # Non-fatal: seed might have already been run
  echo "⚠️  Seed step finished (check output above)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✅ InvoiceAPI is ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " Services:"
echo "   InvoiceAPI  http://localhost:3000"
echo "   PaddleOCR   http://localhost:5000  (health: /health)"
echo "   PostgreSQL  localhost:5432"
echo "   Redis       localhost:6379"
echo ""
echo " Useful commands:"
echo "   docker-compose logs -f app      # follow app logs"
echo "   docker-compose logs -f paddleocr # follow OCR logs"
echo "   docker-compose exec app npx drizzle-kit studio  # DB browser"
echo "   docker-compose down              # stop everything"
echo "   docker-compose down -v           # stop + remove data volumes"
echo ""
