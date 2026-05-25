# Memories Map

A web application that links a library of photos and videos to an interactive map and timeline, allowing users to explore their memories by location and date.

## Implementation Work Plan

For the full backend + frontend + UX execution roadmap, see [IMPLEMENTATION_WORK_PLAN.md](IMPLEMENTATION_WORK_PLAN.md).
For per-workstream release tracking and quality-gate evidence, see [releases/workstreams/INDEX.md](releases/workstreams/INDEX.md).

## Features

- **Interactive map** – Browse all media on a Leaflet map, clustered by location
- **Timeline view** – Browse media grouped by day with a mini per-day map
- **Media viewer** – Full image/video viewer with EXIF metadata display
- **Annotations** – Add notes at map, day, location, or individual media level
- **Multiple maps** – Create as many Memories Maps as you like
- **Colour themes** – Apply one of 6 built-in themes (including a WCAG AAA high-contrast theme) per map
- **Guest sharing** – Invite viewers by email; randomly generated passwords they can change
- **WCAG AAA** – Full ARIA adherence, skip links, focus management, reduced-motion support
- **LAMP deployable** – PHP 8.2/Laravel 11 backend + compiled React/TypeScript frontend

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | PHP 8.2, Laravel 11, Laravel Sanctum |
| Database | MySQL 8.4 |
| Frontend | React 18, TypeScript, Vite, React-Leaflet |
| Maps | Leaflet.js + OpenStreetMap tiles |
| State | Zustand, TanStack Query |
| Media processing | PHP `exif_read_data()`, Intervention Image, ffprobe/ffmpeg |
| Local dev | Docker Compose (PHP-FPM + Nginx + MySQL) |
| Production | Apache 2.4, PHP-FPM, MySQL, Let's Encrypt TLS |

---

## Quick Start (Windows)

Run these commands from PowerShell in the project root:

```powershell
# 1. Copy backend env
Copy-Item backend/.env.example backend/.env

# 2. Start services
docker compose up -d --build

# 3. First-time setup
docker compose exec app php /var/www/memories-map/backend/artisan key:generate --force
docker compose exec app php /var/www/memories-map/backend/artisan migrate --seed --force
```

App URLs:
- Frontend: http://localhost:5173
- API: http://localhost:8080/api

---

## Common Tasks (Suggested Workflow)

If you are deciding what kind of change to make next, use one of these common tracks.

### 1) Bug fix

- Reproduce the issue in Docker first.
- Validate backend logic:

```bash
docker compose exec app php /var/www/memories-map/backend/artisan test
```

- Validate frontend compile/lint (PowerShell):

```powershell
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run lint
```

### 2) Feature work

- Add backend API changes first (controllers, policies, validation).
- Add frontend state/UI changes second.
- Re-run migrations and smoke test the map, timeline, upload, and share flows.

### 3) UI update

- Keep contrast at WCAG 2.2 AAA levels.
- Check keyboard navigation and visible focus states.
- Run frontend checks:

```powershell
npm.cmd --prefix frontend run build
```

### 4) README/documentation update

- Update setup steps when scripts, routes, or deployment flow changes.
- Keep Windows PowerShell command variants where relevant.

### 5) Release/deployment check

- Build frontend artifacts before deploy:

```powershell
npm.cmd --prefix frontend run build
```

- Run backend migrations in the target environment:

```bash
php artisan migrate --force
```

- Verify authentication, map loading, media upload, and shared-link access after release.

---

## Local Development (Docker)

### Prerequisites
- Docker Desktop
- Node 20+ (for running frontend outside Docker, optional)

### Start

```bash
# 1. Copy backend env
cp backend/.env.example backend/.env

# Edit backend/.env – set DB_* values to match docker-compose.yml defaults
# DB_HOST=db  DB_DATABASE=memories_map  DB_USERNAME=memories_map_user  DB_PASSWORD=secret

# 2. Start all services
docker compose up -d --build

# 3. First-time: generate app key and run migrations
docker compose exec app php /var/www/memories-map/backend/artisan key:generate --force
docker compose exec app php /var/www/memories-map/backend/artisan migrate --seed --force
```

### Windows PowerShell commands

```powershell
# 1. Copy backend env
Copy-Item backend/.env.example backend/.env

# 2. Start all services
docker compose up -d --build

# 3. First-time: generate app key and run migrations
docker compose exec app php /var/www/memories-map/backend/artisan key:generate --force
docker compose exec app php /var/www/memories-map/backend/artisan migrate --seed --force
```

### Troubleshooting

- Error: `could not open input file: artisan`
	- Cause: running `php artisan ...` from a working directory where the `artisan` file is not present.
	- Fix: use the full container path shown above: `php /var/www/memories-map/backend/artisan ...`

| Service | URL |
|---------|-----|
| API (via Nginx) | http://localhost:8080/api |
| Frontend (Vite HMR) | http://localhost:5173 |
| MySQL | localhost:3306 |

---

## Queue Worker (Media Processing)

Workstream A moves heavy media processing to the queue. In Docker, a dedicated `queue_worker` service now runs automatically.

Manual worker command (if needed):

```bash
docker compose exec app php /var/www/memories-map/backend/artisan queue:work --queue=media-processing,default --tries=5 --timeout=240 --backoff=10
```

Useful queue operations:

```bash
docker compose exec app php /var/www/memories-map/backend/artisan queue:failed
docker compose exec app php /var/www/memories-map/backend/artisan queue:failed-replay --all
```

Media processing status endpoint:

```text
GET /api/maps/{map}/media/{media}/processing-status
```

---

## Production Deployment (LAMP)

### Server requirements

- Ubuntu 22.04 / Debian 12
- Apache 2.4 with `mod_ssl`, `mod_headers`, `mod_proxy_fcgi`
- PHP 8.2 + extensions: `pdo_mysql`, `mbstring`, `exif`, `gd`, `bcmath`, `pcntl`, `opcache`
- Composer 2
- Node 20 + npm (build only)
- MySQL 8.x
- `ffmpeg` + `ffprobe` (for video thumbnails and metadata)
- Certbot / Let's Encrypt

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Hart365/The_Memories_Map.git /var/www/memories-map

# 2. Configure environment
cp /var/www/memories-map/backend/.env.example /var/www/memories-map/backend/.env
# Edit .env – set APP_URL, DB_*, MAIL_*, MEDIA_STORAGE_PATH, etc.

# 3. Run deployment script (run as root or with sudo)
bash /var/www/memories-map/deploy/deploy.sh

# 4. Enable Apache virtual host
cp /var/www/memories-map/deploy/apache/memories-map.conf /etc/apache2/sites-available/
a2ensite memories-map
a2enmod ssl headers proxy_fcgi rewrite
systemctl reload apache2

# 5. Generate TLS certificate
certbot --apache -d your-domain.com
```

### Media storage

Media files are stored **outside the web root** at the path set in `MEDIA_STORAGE_PATH` (default: `/var/memories-map/media`).  
Ensure this directory is:
- Owned by `www-data`
- `chmod 750` (no world read)
- **Not** accessible via Apache (it is not under `DocumentRoot`)

### cPanel + Softaculous deployment

For shared hosting and standard LAMP with cPanel, use:

- `deploy/CPANEL_SOFTACULOUS_INSTALL.md`
- `deploy/cpanel/post_install.sh`
- `deploy/cpanel/publish_public_html.sh`
- `deploy/cpanel/create_release_zip.sh`
- `deploy/cpanel/create_release_zip.ps1`

Quick path:

1. Upload repo under your home folder (outside `public_html` when possible).
2. Configure `backend/.env` with production DB + app URL values.
3. Optional: create a cPanel-ready release archive locally:

```bash
bash deploy/cpanel/create_release_zip.sh
```

On Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\cpanel\create_release_zip.ps1
```

4. Run:

```bash
bash deploy/cpanel/post_install.sh
```

5. If your host does not allow document root to `backend/public`, publish to `public_html`:

```bash
PUBLIC_HTML_DIR=/home/CPANEL_USER/public_html BACKEND_DIR=/home/CPANEL_USER/memories-map/backend bash deploy/cpanel/publish_public_html.sh
```

This provides an install flow that works with common cPanel/Softaculous constraints.

### Upgrade existing installation (no SSH)

If you already have Memories Map deployed and want to upgrade safely via cPanel File Manager:

1. Back up your current database (phpMyAdmin export) and copy your current `backend/.env`.
2. Build or download the latest cPanel release zip (with vendor bundle).
3. Upload the zip to your cPanel home folder and extract it to your existing app path (for example, `/home/CPANEL_USER/memories-map`).
4. Upload `deploy/cpanel/memories-map-installer.php` to `public_html`.
5. Open `https://your-domain.com/memories-map-installer.php` and run the wizard using your existing app path and database credentials.
6. Let the installer complete migrations and republish frontend/public assets.
7. Delete `memories-map-installer.php` and `memories-map-installer.lock` from `public_html`.

Notes:
- The installer now preserves an existing `APP_KEY` during upgrades so encrypted data remains readable.
- Do not run migration files directly; the installer runs Laravel migrations automatically.
- If you deploy manually without the installer, run `php artisan migrate --force` once in the backend.

---

## Project Structure

```
The_Memories_Map/
├── backend/                   # Laravel 11 PHP API
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   ├── Http/Middleware/
│   │   ├── Models/
│   │   ├── Policies/
│   │   └── Services/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/api.php
├── frontend/                  # React 18 + TypeScript + Vite
│   └── src/
│       ├── components/        # Shared UI components
│       ├── pages/             # Route-level pages
│       ├── store/             # Zustand auth store
│       ├── lib/               # Axios instance
│       ├── types/             # Shared TypeScript types
│       └── styles/            # Global & component CSS
├── docker/                    # Local dev Docker config
│   ├── php/Dockerfile
│   └── nginx/default.conf
├── deploy/                    # Production deployment
│   ├── apache/memories-map.conf
│   └── deploy.sh
└── docker-compose.yml
```

---

## Security

- All API routes require a Sanctum bearer token (30-day expiry)
- Guest tokens are random 64-character strings; validated in `GuestMapAccess` middleware
- Passwords: bcrypt with 14 rounds, minimum 12 chars + mixed case + numbers + symbols
- Guest access tokens validated per-map to prevent token reuse across maps
- Media served via PHP controller (never via direct Apache URL)
- Uploaded originals and generated thumbnails are encrypted at rest on disk (`MEDIA_ENCRYPTION_ENABLED=true`)
- Optional dedicated key supported via `MEDIA_ENCRYPTION_KEY` (falls back to `APP_KEY`)
- Existing plaintext media can be migrated with `php artisan media:encrypt-existing`
- Media files are stored under per-map UUID subfolders to isolate tenant data on disk
- Deleting a map cascades to delete all associated media records and media files
- Sessions encrypted (`SESSION_ENCRYPT=true`)
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers set in Apache config
- Modern TLS only (TLS 1.2/1.3)
- Soft deletes on all sensitive models
- All user input validated with Laravel's `validate()` rules

---

## Accessibility (WCAG AAA)

- Skip-to-content link on every page
- All interactive elements reachable by keyboard; `:focus-visible` never suppressed
- ARIA `role`, `aria-label`, `aria-live`, `aria-required`, `aria-busy`, `aria-expanded` throughout
- High-contrast theme available
- `prefers-reduced-motion` respected in CSS
- `<video>` elements include fallback text and native `controls`
- Images always have descriptive `alt` text
- Form errors linked to inputs with `aria-describedby`
- Toasts use `role="status"` with `aria-live="polite"`

---

## Licence

MIT © 2026 Hart365
