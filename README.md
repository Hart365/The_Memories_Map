# Memories Map

A web application that links a library of photos and videos to an interactive map and timeline, allowing users to explore their memories by location and date.

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
