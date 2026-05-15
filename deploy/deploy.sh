#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh  –  Production deployment script for Memories Map
#
# Usage:
#   ./deploy/deploy.sh [--skip-frontend] [--skip-migrate]
#
# Requirements:
#   - PHP 8.2+, Composer, Node 20+, npm on PATH
#   - MySQL running; .env configured
#   - Run as a user with write access to /var/www/memories-map
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEPLOY_DIR="/var/www/memories-map"
MEDIA_DIR="/var/memories-map/media"
SKIP_FRONTEND=false
SKIP_MIGRATE=false

for arg in "$@"; do
  case $arg in
    --skip-frontend) SKIP_FRONTEND=true ;;
    --skip-migrate)  SKIP_MIGRATE=true  ;;
  esac
done

echo "==> Memories Map deploy started at $(date)"

# ── Pull latest code ──────────────────────────────────────────────────────────
cd "$DEPLOY_DIR"
git pull origin main

# ── Backend ───────────────────────────────────────────────────────────────────
echo "--> Installing PHP dependencies"
cd "$DEPLOY_DIR/backend"
composer install --no-dev --optimize-autoloader --no-interaction

echo "--> Caching Laravel config & routes"
php artisan config:cache
php artisan route:cache
php artisan view:cache

if [ "$SKIP_MIGRATE" = false ]; then
  echo "--> Running database migrations"
  php artisan migrate --force
  php artisan db:seed --class=ColorThemeSeeder --force
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
if [ "$SKIP_FRONTEND" = false ]; then
  echo "--> Building frontend"
  cd "$DEPLOY_DIR/frontend"
  npm ci --prefer-offline
  npm run build
  # Output lands in backend/public (configured in vite.config.ts)
fi

# ── Permissions ───────────────────────────────────────────────────────────────
echo "--> Setting permissions"
chown -R www-data:www-data "$DEPLOY_DIR/backend/storage" "$DEPLOY_DIR/backend/bootstrap/cache"
chmod -R 775 "$DEPLOY_DIR/backend/storage" "$DEPLOY_DIR/backend/bootstrap/cache"

# Ensure media directory exists with correct permissions
mkdir -p "$MEDIA_DIR/thumbnails"
chown -R www-data:www-data "$MEDIA_DIR"
chmod -R 750 "$MEDIA_DIR"

# ── Reload PHP-FPM ────────────────────────────────────────────────────────────
echo "--> Reloading PHP-FPM"
systemctl reload php8.2-fpm

echo "==> Deploy complete at $(date)"
