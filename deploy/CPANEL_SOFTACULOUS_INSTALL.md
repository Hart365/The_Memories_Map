# Memories Map on cPanel + Softaculous (LAMP)

This guide covers two installation methods. If you do not have SSH access, use **Method A** (Web Installer).

---

## Method A — Web Installer (Recommended, no SSH required)

The web installer is a guided wizard that configures the database, writes `.env`, runs migrations, and publishes the app to your `public_html` — entirely through your browser.

### Step-by-step

1. **Build the installer release archive** on your local machine:

   Windows PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\deploy\cpanel\create_release_zip.ps1 -IncludeVendor
   ```

   Linux/macOS:
   ```bash
   bash deploy/cpanel/create_release_zip.sh --include-vendor
   ```

   Output: `deploy/releases/memories-map-cpanel-with-vendor-TIMESTAMP.zip`

2. **Create a MySQL database** in cPanel → *MySQL Databases*. Note the host, database name, username, and password.

3. **Upload the zip** via cPanel *File Manager* → upload to your home directory (e.g. `/home/yourusername/`).

4. **Extract the zip** in File Manager. This creates `/home/yourusername/memories-map/`.

5. **Upload the installer script** — upload `deploy/cpanel/memories-map-installer.php` from this project to your `public_html` directory.

6. **Visit the installer** in your browser:
   ```
   https://your-domain.com/memories-map-installer.php
   ```

7. **Follow the wizard** — it will:
   - Check server requirements
   - Ask where you extracted the package (e.g. `/home/yourusername/memories-map`)
   - Test your database connection
   - Configure the app URL and name
   - Write `.env`, run migrations, seed defaults, and publish the frontend

8. **Delete the installer files** from `public_html` immediately after completion:
   - `memories-map-installer.php`
   - `memories-map-installer.lock`

9. **Visit the Admin Console** at `https://your-domain.com/admin` to configure mail delivery.
   Default credentials: Username `MemoriesAdmin` / Password `WeC4nRemember!tForYouWh0le$al3` — **change these immediately**.

---

## Method B — Manual Installation (SSH required)

> Use this method if you have SSH/terminal access and prefer to configure manually.

## 1) Host Requirements

- PHP 8.2 or newer
- MySQL or MariaDB database
- PHP extensions: pdo_mysql, mbstring, exif, gd, bcmath, fileinfo, openssl
- SSH/Terminal access in cPanel is strongly recommended
- Node.js is optional (required only if you build frontend on the server)

## 2) Recommended Deployment Layout

- Keep application code outside public web root when possible.

Example:
- App code: /home/CPANEL_USER/memories-map
- Laravel backend: /home/CPANEL_USER/memories-map/backend
- Frontend: /home/CPANEL_USER/memories-map/frontend
- Public web root: /home/CPANEL_USER/public_html

## 3) Upload Code

Use Git Version Control in cPanel or upload a release zip to /home/CPANEL_USER/memories-map.

### Build an upload zip locally (recommended)

From the project root, generate a cPanel-ready archive:

Linux/macOS:

```bash
bash deploy/cpanel/create_release_zip.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\cpanel\create_release_zip.ps1
```

Output is written under deploy/releases by default.

## 4) Configure Environment

Create backend/.env from backend/.env.example and set at minimum:

- APP_ENV=production
- APP_DEBUG=false
- APP_URL=https://your-domain.com
- FRONTEND_URL=https://your-domain.com
- DB_CONNECTION=mysql
- DB_HOST=localhost
- DB_PORT=3306
- DB_DATABASE=your_db_name
- DB_USERNAME=your_db_user
- DB_PASSWORD=your_db_password
- SESSION_DRIVER=file
- CACHE_STORE=file
- QUEUE_CONNECTION=sync
- LOG_CHANNEL=stack
- LOG_LEVEL=warning

Optional media path (recommended outside web root):
- MEDIA_STORAGE_PATH=/home/CPANEL_USER/memories-media

## 5) Run Post-Install Script (recommended)

From cPanel Terminal at repository root:

```bash
bash deploy/cpanel/post_install.sh
```

Options:

```bash
bash deploy/cpanel/post_install.sh --skip-frontend
bash deploy/cpanel/post_install.sh --skip-migrations
```

If binaries are not on PATH:

```bash
PHP_BIN=/opt/cpanel/ea-php82/root/usr/bin/php \
COMPOSER_BIN=/opt/cpanel/composer/bin/composer \
NPM_BIN=/opt/cpanel/ea-nodejs20/bin/npm \
bash deploy/cpanel/post_install.sh
```

## 6) Publish to public_html

If you cannot set your domain document root to backend/public, publish assets to public_html:

```bash
PUBLIC_HTML_DIR=/home/CPANEL_USER/public_html \
BACKEND_DIR=/home/CPANEL_USER/memories-map/backend \
bash deploy/cpanel/publish_public_html.sh
```

This script will:
- Copy backend/public contents to public_html
- Create public_html/index.php pointing to your backend path
- Copy Laravel rewrite rules to public_html/.htaccess

## 7) If You Can Set Document Root (better)

For addon domain/subdomain, set document root directly to:

- /home/CPANEL_USER/memories-map/backend/public

Then you do not need deploy/cpanel/publish_public_html.sh.

## 8) Softaculous Notes

Softaculous can help create a Laravel app skeleton, but for this repository you should deploy this codebase directly.

If you already used Softaculous to create a Laravel app:
- Keep DB and domain configuration it created
- Replace project files with this repository files
- Re-run post install script

## 9) File Permissions

Typical shared-hosting-safe permissions:

- backend/storage and backend/bootstrap/cache must be writable by PHP
- Folders: 755 (owner = 7)
- Files: 644 (owner = 6)

The web installer now applies these permissions recursively across the extracted app after setup. Use the manual commands below only if your host blocks `chmod`.

If needed:

```bash
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;
```

## 10) Verification Checklist

- https://your-domain.com loads login page
- https://your-domain.com/api/public/settings returns JSON
- Admin URL works: https://your-domain.com/admin
- Media upload works
- Guest sharing works

## 11) Troubleshooting Matrix

| Symptom | Likely Cause | Fix |
|---|---|---|
| 500 Internal Server Error on first load | Missing APP_KEY or wrong PHP version | Set PHP to 8.2+ in cPanel; ensure backend/.env exists; run php artisan key:generate |
| Login page loads but API calls fail | Wrong APP_URL/FRONTEND_URL or DB settings | Correct backend/.env values; run php artisan config:clear && php artisan config:cache |
| /api/* returns 404 | Missing rewrite rules in public_html | Ensure public_html/.htaccess exists and includes Laravel rewrite rules |
| public_html shows directory listing | index.php not published correctly | Re-run deploy/cpanel/publish_public_html.sh and confirm public_html/index.php exists |
| App works but CSS/JS stale | Browser cache or old assets | Rebuild frontend; rerun publish script; hard refresh browser |
| Registration fails with CSRF/401-like behavior | Host-level caching/proxy issue | Disable aggressive HTML caching in cPanel optimization plugins; verify same-domain access |
| Cannot write logs/cache | Permissions on storage/cache dirs | Ensure backend/storage and backend/bootstrap/cache are writable by PHP user |
| Composer out-of-memory during install | Shared host memory limit | Run composer install with COMPOSER_MEMORY_LIMIT=-1 or use host terminal profile with higher memory |
| Node.js unavailable in hosting | Shared plan limitation | Build locally with create_release_zip script and upload archive; skip frontend build on server |
| Media upload fails on large files | PHP upload/post limits too low | Increase upload_max_filesize, post_max_size, and max_execution_time in cPanel MultiPHP INI |
| Shared links open but media fails | Incorrect MEDIA_STORAGE_PATH or permissions | Set MEDIA_STORAGE_PATH to valid server path and ensure readable by PHP process |
| Admin page works but mail test fails | SMTP blocked or wrong port/security | Validate host/port/encryption; try 587+TLS or provider-recommended settings |

## 12) Upgrades

For future updates:

```bash
git pull
bash deploy/cpanel/post_install.sh
PUBLIC_HTML_DIR=/home/CPANEL_USER/public_html BACKEND_DIR=/home/CPANEL_USER/memories-map/backend bash deploy/cpanel/publish_public_html.sh
```
