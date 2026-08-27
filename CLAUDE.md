# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SubLens (repo: sublens) is a Chrome Extension (Manifest V3) that tracks AI subscription status across multiple services. It reads authentication cookies, calls provider APIs from the background service worker, and displays subscription cards in a React popup.

## Commands

- **Dev server:** `npm run dev`
- **Build:** `npm run build` (runs `tsc && vite build`, outputs to `dist/`)
- **Type check only:** `npx tsc --noEmit`

No test framework is configured. No linter is configured.

## Architecture

**Entry points** (defined in `vite.config.ts` rollup inputs):
- `popup.html` → `src/popup/main.tsx` — React popup UI
- `src/background/index.ts` — Service worker that refreshes subscriptions on an hourly alarm and on install

**Provider pattern** (`src/providers/`):
- `base.ts` — `SubscriptionInfo` interface (common data shape) and `SubscriptionProvider` interface (id, name, fetch method)
- Each provider file (cursor, copilot, chatgpt, claude, googleone) exports a `SubscriptionProvider` that reads cookies via `chrome.cookies.get()` and fetches the service's API
- `index.ts` — registers all providers in the `providers` array. New providers must be added here.

**Storage** (`src/storage.ts`):
- Wraps `chrome.storage.local` for subscription data and card ordering
- All data is keyed by provider id

**Popup** (`src/popup/`):
- `App.tsx` — main component with drag-to-reorder cards, theme cycling (light/dark/system), manual refresh
- `SubscriptionCard.tsx` — individual subscription display
- `SummaryCard.tsx` — paid count and total monthly cost
- `SkeletonCard.tsx` — loading placeholder

**Communication:** Popup can send `{ type: "refresh" }` messages to background; background calls `refreshAll()` and responds.

## Adding a New Provider

1. Create `src/providers/<name>.ts` implementing `SubscriptionProvider`
2. Add host permission in `manifest.json`
3. Register in `src/providers/index.ts` (both export and `providers` array)
4. Add logo SVG to `public/logos/`

## Key Conventions

- Provider fetch methods return a `SubscriptionInfo` with `error` field on failure rather than throwing
- Cookie-based auth: each provider reads its service's session cookie to authenticate API calls
- Static assets (icons, logos) live in `public/` and are copied to `dist/` during build
- `manifest.json` is copied to `dist/` by a custom Vite plugin in `vite.config.ts`

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. Use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo. See `docs/agents/domain.md`.
