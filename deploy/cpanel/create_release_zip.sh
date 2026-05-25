#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/deploy/releases}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
NPM_BIN="${NPM_BIN:-npm}"
SKIP_FRONTEND_BUILD="false"
INCLUDE_VENDOR="false"
OUTPUT_PATH=""

for arg in "$@"; do
  case "$arg" in
    --skip-frontend-build)
      SKIP_FRONTEND_BUILD="true"
      ;;
    --include-vendor)
      INCLUDE_VENDOR="true"
      ;;
    --output=*)
      OUTPUT_PATH="${arg#*=}"
      ;;
  esac
done

if [ -z "$OUTPUT_PATH" ]; then
  SUFFIX="$([ "$INCLUDE_VENDOR" = "true" ] && echo "with-vendor" || echo "no-vendor")"
  OUTPUT_PATH="$OUTPUT_DIR/memories-map-cpanel-${SUFFIX}-${TIMESTAMP}.zip"
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

if ! command -v zip >/dev/null 2>&1; then
  echo "ERROR: zip command is required to create release archives."
  exit 1
fi

if [ "$SKIP_FRONTEND_BUILD" = "false" ]; then
  echo "--> Building frontend assets"
  # Clean only generated frontend artifacts; keep backend/public/index.php and .htaccess intact.
  rm -rf "$ROOT_DIR/backend/public/assets"/*
  rm -f "$ROOT_DIR/backend/public/index.html"
  cd "$ROOT_DIR/frontend"
  "$NPM_BIN" ci
  "$NPM_BIN" run build
fi

echo "--> Creating release staging directory"
STAGE_ROOT="$(mktemp -d)"
PACKAGE_ROOT="$STAGE_ROOT/memories-map"
mkdir -p "$PACKAGE_ROOT"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude='.env' --exclude='vendor' --exclude='storage/app/*' --exclude='storage/logs/*' --exclude='storage/framework/cache/*' --exclude='storage/framework/sessions/*' --exclude='storage/framework/views/*' "$ROOT_DIR/backend/" "$PACKAGE_ROOT/backend/"
  rsync -a --exclude='node_modules' "$ROOT_DIR/frontend/" "$PACKAGE_ROOT/frontend/"
else
  cp -R "$ROOT_DIR/backend" "$PACKAGE_ROOT/backend"
  cp -R "$ROOT_DIR/frontend" "$PACKAGE_ROOT/frontend"
fi

mkdir -p "$PACKAGE_ROOT/deploy"
cp -R "$ROOT_DIR/deploy/cpanel" "$PACKAGE_ROOT/deploy/cpanel"
cp "$ROOT_DIR/deploy/CPANEL_SOFTACULOUS_INSTALL.md" "$PACKAGE_ROOT/deploy/CPANEL_SOFTACULOUS_INSTALL.md"
cp "$ROOT_DIR/README.md" "$PACKAGE_ROOT/README.md"

# Vendor directory
if [ "$INCLUDE_VENDOR" = "true" ]; then
  echo "--> Copying vendor directory (this may take a minute)"
  cp -R "$ROOT_DIR/backend/vendor" "$PACKAGE_ROOT/backend/vendor"

  echo "--> Creating vendor recovery bundle"
  rm -f "$PACKAGE_ROOT/deploy/cpanel/vendor.bundle.zip"
  (
    cd "$ROOT_DIR/backend"
    zip -rq "$PACKAGE_ROOT/deploy/cpanel/vendor.bundle.zip" vendor
  )
else
  rm -rf "$PACKAGE_ROOT/backend/vendor"
fi

rm -rf "$PACKAGE_ROOT/frontend/node_modules"
rm -f "$PACKAGE_ROOT/backend/.env"
rm -rf "$PACKAGE_ROOT/backend/storage/app"/*
rm -rf "$PACKAGE_ROOT/backend/storage/logs"/*
rm -rf "$PACKAGE_ROOT/backend/storage/framework/cache"/*
rm -rf "$PACKAGE_ROOT/backend/storage/framework/sessions"/*
rm -rf "$PACKAGE_ROOT/backend/storage/framework/views"/*

if [ "$INCLUDE_VENDOR" = "true" ]; then
cat > "$PACKAGE_ROOT/INSTALL_ON_CPANEL.txt" <<'TXT'
QUICK INSTALL (Web Installer — no SSH needed)
=============================================
1. In cPanel File Manager, upload and extract this archive to your home directory
   (e.g. /home/YOURUSER/memories-map). Do NOT extract inside public_html.
2. Upload deploy/cpanel/memories-map-installer.php to your public_html directory.
3. Visit https://your-domain.com/memories-map-installer.php in your browser.
4. Follow the on-screen wizard. The installer configures everything for you.
5. DELETE the installer files from public_html when complete (the wizard will remind you).

Full guide: deploy/CPANEL_SOFTACULOUS_INSTALL.md
TXT
else
cat > "$PACKAGE_ROOT/INSTALL_ON_CPANEL.txt" <<'TXT'
INSTALL (SSH/Composer required)
================================
1. Upload and extract this archive in your cPanel home directory (not inside public_html).
2. Copy backend/.env.example to backend/.env and configure APP_URL + DB credentials.
3. Run: bash deploy/cpanel/post_install.sh
4. If document root cannot point to backend/public, run:
   PUBLIC_HTML_DIR=/home/CPANEL_USER/public_html BACKEND_DIR=/home/CPANEL_USER/memories-map/backend bash deploy/cpanel/publish_public_html.sh
5. Full guide: deploy/CPANEL_SOFTACULOUS_INSTALL.md

NOTE: For a no-SSH install, use: bash deploy/cpanel/create_release_zip.sh --include-vendor
TXT
fi

echo "--> Creating zip archive"
(
  cd "$STAGE_ROOT"
  zip -rq "$OUTPUT_PATH" "memories-map"
)

rm -rf "$STAGE_ROOT"

echo "==> Release archive created"
echo "$OUTPUT_PATH"
