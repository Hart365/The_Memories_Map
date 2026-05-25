# Workstream Release Process

## Purpose
Each workstream must produce a unique release file when a milestone is completed.

## File Naming Convention
Use this format:

`YYYY-MM-DD_WS-<LETTER>_<slug>_R<nn>.md`

Example:

`2026-05-25_WS-D_accessibility-interaction_R01.md`

## Required Sections
1. Scope completed
2. Code changes
3. Commenting standard confirmation
4. Documentation updates
5. Test evidence
6. WCAG 2.2 AAA verification evidence
7. Risks and follow-ups
8. Sign-off

## Required Quality Gates
1. Backend tests run in Docker
2. Frontend lint/build run in Docker
3. WCAG 2.2 AAA checks run in Docker
4. Release file includes command log summary and outcomes

## Notes
1. Workstream release files are append-only records.
2. Use a new unique `Rnn` number per workstream update.
3. Do not mark a workstream complete without test evidence.
