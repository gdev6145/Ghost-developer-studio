#!/usr/bin/env bash
# ─── Ghost Developer Studio — Development Setup ───────────────────────────────
# Usage: ./scripts/dev-setup.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "  ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗"
echo "  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝"
echo "  ██║  ███╗███████║██║   ██║███████╗   ██║"
echo "  ██║   ██║██╔══██║██║   ██║╚════██║   ██║"
echo "  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║"
echo "   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝"
echo -e "${NC}"
echo "  Ghost Developer Studio — Development Setup"
echo ""

# Check dependencies
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required. Run: npm install -g pnpm@9"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required for runtime features. Install from https://docker.com"; }

echo -e "${GREEN}✓${NC} Node.js: $(node --version)"
echo -e "${GREEN}✓${NC} pnpm: $(pnpm --version)"
echo ""

# Copy env file
if [ ! -f .env ]; then
  echo -e "${YELLOW}→${NC} Creating .env from .env.example..."
  cp .env.example .env
  echo -e "${GREEN}✓${NC} .env created. Edit it with your configuration."
else
  echo -e "${GREEN}✓${NC} .env already exists"
fi

# Install dependencies
echo ""
echo -e "${YELLOW}→${NC} Installing dependencies..."
pnpm install
echo -e "${GREEN}✓${NC} Dependencies installed"

# Start infrastructure
echo ""
echo -e "${YELLOW}→${NC} Starting PostgreSQL and Redis..."
docker compose -f docker/docker-compose.yml up -d postgres redis
echo -e "${GREEN}✓${NC} Infrastructure started"

# Wait for postgres
echo -e "${YELLOW}→${NC} Waiting for PostgreSQL to be ready..."
until docker exec ghost_postgres pg_isready -U ghost -d ghost_db >/dev/null 2>&1; do
  printf '.'
  sleep 1
done
echo ""
echo -e "${GREEN}✓${NC} PostgreSQL ready"

# Run migrations
echo -e "${YELLOW}→${NC} Running database migrations..."
pnpm --filter "@ghost/database" run db:migrate
echo -e "${GREEN}✓${NC} Migrations complete"

# Build packages
echo ""
echo -e "${YELLOW}→${NC} Building shared packages..."
pnpm run build --filter="./packages/*"
echo -e "${GREEN}✓${NC} Packages built"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Ghost Developer Studio is ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Start the development servers:"
echo "    pnpm run dev"
echo ""
echo "  Or start individual apps:"
echo "    pnpm --filter @ghost/server run dev   # Backend (port 4000)"
echo "    pnpm --filter @ghost/web run dev       # Web app (port 3000)"
echo ""
echo "  Open the web app: http://localhost:3000"
echo ""
