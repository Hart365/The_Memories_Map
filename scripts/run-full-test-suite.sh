#!/usr/bin/env bash
set -euo pipefail

export DB_CONNECTION=sqlite
export DB_DATABASE="$(pwd)/backend/database/testing.sqlite"
touch "$DB_DATABASE"

echo "Running backend feature+unit tests..."
php ./backend/artisan migrate:fresh --force
php ./backend/artisan test

echo "Running frontend unit tests with coverage..."
npm --prefix frontend run test:coverage

echo "Running frontend WCAG 2.2 AAA accessibility suite..."
npm --prefix frontend run a11y:test

echo "Full platform suite completed."
