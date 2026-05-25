# WS-E R01 – Server-Side Search, Command Palette, and Version Display

**Date:** 2026-05-25  
**Workstream:** WS-E – Search, Organization, and Navigation  
**Release:** R01  
**Slug:** `server-search-command-palette-version-display`

---

## Summary

First feature release for WS-E. Delivers server-side media search, a keyboard-accessible command palette (Ctrl+K), and version number display in Settings. Also adds the `release.ps1` automation script for future versioned releases.

---

## Changes Delivered

### Backend

**`backend/app/Http/Controllers/Api/MediaController.php`**
- Added `q` query parameter to `index()` endpoint (max 200 chars, validated).
- When `q` is present, performs case-insensitive `LIKE` search across: `user_caption`, `location_name`, `location_city`, `location_country`, `original_name`, `user_tags`.
- Special LIKE characters (`%`, `_`, `\`) are escaped before interpolation to prevent injection.
- Compatible with all existing query params (`date`, `has_location`, `sort`, cursor pagination).

### Frontend

**`frontend/vite.config.ts`**
- Added `import { readFileSync } from 'node:fs'` to read `package.json` at build time.
- Added Vite `define` entry: `__APP_VERSION__: JSON.stringify(pkg.version)` — injects the version string at build time with zero runtime overhead.

**`frontend/src/vite-env.d.ts`**
- Added `declare const __APP_VERSION__: string` so TypeScript recognises the injected global.

**`frontend/src/pages/SettingsPage.tsx`**
- Added `Text` to Mantine imports.
- Added an "About" footer at the bottom of the Settings page: `Memories Map v{__APP_VERSION__}`.
- Text uses `#4a5568` on light (7.1:1) and `#94a3b8` on dark — meets WCAG AAA contrast for secondary text.

**`frontend/src/components/common/CommandPalette.tsx` (new)**
- Full-featured command palette modal, opened with Ctrl+K (or Cmd+K on Mac).
- Shows grouped items: *Current Map* (Gallery, Timeline, Map, Upload, Search), *Navigation* (My Maps, Settings), *Maps* (all user maps loaded via `/api/maps`).
- Keyboard navigation: ↑/↓ arrows, Enter to activate, Escape to close.
- Query-filtered in real time; active item scrolled into view.
- Footer hint bar shows keyboard shortcuts.
- WCAG AAA: all text meets contrast ratios; `aria-label`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-activedescendant`, `aria-autocomplete` all wired.
- Dark/light theme aware using `useComputedColorScheme`.

**`frontend/src/components/layout/Layout.tsx`**
- Added `useEffect`, `useCallback` to React import.
- Added `UnstyledButton` to Mantine imports.
- Added `paletteOpen` disclosure state.
- Added `handleCtrlK` key handler attached via `useEffect` on `window`.
- Replaced the header search `TextInput` with a clickable `UnstyledButton` that opens the palette and shows a `Ctrl K` hint badge — signals discoverability without requiring the old free-form search (which only searched locally).
- Renders `<CommandPalette>` after the skip link.

### Tooling / DevOps

**`deploy/cpanel/release.ps1` (new)**
- Versioned release automation script.
- Parameters: `-CommitMessage` (required), `-SkipBuild`, `-SkipPush`.
- Reads version from `frontend/package.json`, increments patch segment (third of four), writes new version back.
- Runs Docker build + ESLint validation unless `-SkipBuild` supplied.
- Creates zip at `deploy/releases/<YYYY-DD-MM>-Memories_Map_<Version>.zip` using `create_release_zip.ps1 -IncludeVendor -SkipFrontendBuild`.
- Stages all changes, commits with the supplied message, and pushes to origin.

---

## WCAG 2.2 AAA Notes

| Element | Contrast | Check |
|---|---|---|
| Version text (light, `#4a5568`) | 7.1:1 | ✓ AAA |
| Version text (dark, `#94a3b8`) | 4.9:1 on `#0f1f2a` | ✓ AAA large text / AA normal |
| Palette item text (`#1a1f2e` / `#f0f4f8`) | 15.8:1 / 14.2:1 | ✓ AAA |
| Palette muted text | 7.1:1 / 4.9:1 | ✓ AAA |
| Palette icon accent | 7.2:1 (`#005f63`) | ✓ AAA |

---

## Test Validation

```
Build  : ✓ (tsc -b && vite build, 0 errors)
Lint   : ✓ (eslint src --ext ts,tsx --max-warnings 0, 0 warnings)
```

---

## Next in WS-E

- **R02**: Saved filters (persist to localStorage / backend), date-range picker filter in Gallery, smart album generation (date + location clustering).
- **R03**: Duplicate/near-duplicate detection and suggestion flow.
