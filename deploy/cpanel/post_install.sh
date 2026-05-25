#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$ROOT_DIR/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PHP_BIN="${PHP_BIN:-php}"
COMPOSER_BIN="${COMPOSER_BIN:-composer}"
NPM_BIN="${NPM_BIN:-npm}"
SKIP_FRONTEND="false"
SKIP_MIGRATIONS="false"

for arg in "$@"; do
  case "$arg" in
    --skip-frontend)
      SKIP_FRONTEND="true"
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS="true"
      ;;
  esac
done

echo "==> cPanel post-install starting"
echo "ROOT_DIR=$ROOT_DIR"

cd "$BACKEND_DIR"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created backend/.env from .env.example"
fi

echo "--> Installing PHP dependencies"
"$COMPOSER_BIN" install --no-dev --optimize-autoloader --no-interaction

if ! "$PHP_BIN" artisan key:generate --show >/dev/null 2>&1; then
  echo "WARNING: Unable to read APP_KEY from environment."
fi

if ! grep -q "^APP_KEY=base64:" .env; then
  echo "--> Generating APP_KEY"
  "$PHP_BIN" artisan key:generate --force
fi

if [ "$SKIP_MIGRATIONS" = "false" ]; then
  echo "--> Running migrations and seeders"
  "$PHP_BIN" artisan migrate --force
  "$PHP_BIN" artisan db:seed --class=ColorThemeSeeder --force
fi

if [ "$SKIP_FRONTEND" = "false" ]; then
  echo "--> Building frontend"
  cd "$FRONTEND_DIR"
  "$NPM_BIN" ci
  "$NPM_BIN" run build
  cd "$BACKEND_DIR"
else
  echo "--> Skipping frontend build"
fi

echo "--> Preparing Laravel caches"
"$PHP_BIN" artisan config:clear
"$PHP_BIN" artisan route:clear
"$PHP_BIN" artisan view:clear
"$PHP_BIN" artisan config:cache
"$PHP_BIN" artisan route:cache
"$PHP_BIN" artisan view:cache

if [ ! -L "$BACKEND_DIR/public/storage" ]; then
  echo "--> Creating storage symlink"
  "$PHP_BIN" artisan storage:link || true
fi

mkdir -p "$BACKEND_DIR/storage/framework/cache" "$BACKEND_DIR/storage/framework/sessions" "$BACKEND_DIR/storage/framework/views" "$BACKEND_DIR/storage/logs"

echo "==> cPanel post-install complete"
