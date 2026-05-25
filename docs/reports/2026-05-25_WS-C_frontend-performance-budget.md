# Workstream C Frontend Performance Budget

## Scope
1. Keep route-level code splitting in place for the main authenticated and guest views.
2. Defer media image decoding and network fetches until thumbnails enter view.
3. Preserve the existing upload progress/retry flow without adding main-thread work during list rendering.

## Current Guardrails
1. Route fallback remains a lightweight centered loading state.
2. Media-heavy gallery, timeline, map popup, and shared-access thumbnails now use progressive image loading.
3. Large media previews remain tied to user action instead of eager page load.

## Budget Targets
1. Avoid loading full-size media assets during initial route paint.
2. Keep thumbnail decoding incremental for long lists and map popups.
3. Keep frontend build output stable while asset chunking changes are introduced.

## Follow-Up Items
1. Add a true virtualization layer for the longest gallery and timeline lists in a later WS-C increment.
2. Measure route paint and thumbnail decode timing once authenticated browser metrics are available.