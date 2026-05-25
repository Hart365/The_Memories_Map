#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$ROOT_DIR/backend}"
PUBLIC_HTML_DIR="${PUBLIC_HTML_DIR:-}"
PUBLIC_INDEX_TEMPLATE="$ROOT_DIR/deploy/cpanel/public_html_index.php"

if [ -z "$PUBLIC_HTML_DIR" ]; then
  echo "Usage: PUBLIC_HTML_DIR=/home/USER/public_html BACKEND_DIR=/home/USER/myapp/backend $0"
  exit 1
fi

if [ ! -d "$BACKEND_DIR/public" ]; then
  echo "ERROR: backend public directory not found at $BACKEND_DIR/public"
  exit 1
fi

mkdir -p "$PUBLIC_HTML_DIR"

echo "--> Copying built frontend and Laravel public assets"
rsync -a --delete "$BACKEND_DIR/public/" "$PUBLIC_HTML_DIR/"

APP_ROOT_REAL="$(cd "$BACKEND_DIR" && pwd)"
INDEX_TARGET="$PUBLIC_HTML_DIR/index.php"

cp "$PUBLIC_INDEX_TEMPLATE" "$INDEX_TARGET"
sed -i "s#__APP_ROOT__#$APP_ROOT_REAL#g" "$INDEX_TARGET"

echo "--> Ensuring Laravel rewrite rules exist"
cp "$BACKEND_DIR/public/.htaccess" "$PUBLIC_HTML_DIR/.htaccess"

echo "--> Locking down sensitive folders in public_html"
cat > "$PUBLIC_HTML_DIR/.user.ini" <<'INI'
expose_php=Off
display_errors=Off
INI

echo "==> publish_public_html complete"
echo "Public path: $PUBLIC_HTML_DIR"
echo "App root used by index.php: $APP_ROOT_REAL"
