# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SubLens (repo: sublens) is a Chrome Extension (Manifest V3) combining a fast AI-tool launcher with local, opt-in subscription tracking across services (Cursor, GitHub Copilot, ChatGPT, Claude, ...). The popup is the launcher/dashboard; a separate options page (opened in a tab) manages custom tools, provider connections, and preferences. Provider fetches run from the background service worker.

See `CONTEXT.md` for the domain vocabulary (Tool vs Built-in Tool vs Custom Tool, Subscription Provider, Subscription Snapshot, Connection, Launch) — use these terms, not their `_Avoid_` synonyms, in code, comments, and commit messages.

## Commands

- **Dev server:** `npm run dev`
- **Build:** `npm run build` (runs `tsc && vite build`, outputs to `dist/`); `npm run build:fast` skips the type check
- **Type check:** `npm run typecheck`
- **Lint:** `npm run lint` / `npm run lint:fix`
- **Format:** `npm run format` / `npm run format:check`
- **Tests:** `npm test` (vitest run). Test files sit next to their source as `*.test.ts`.

Load `dist/` via `chrome://extensions` (Developer mode) for manual extension testing.

## Architecture

**Entry points** (`vite.config.ts` rollup inputs), each with its own `main.tsx`:
- `popup.html` → `src/popup/main.tsx` — launcher/dashboard popup
- `options.html` → `src/options/main.tsx` — settings page (`options_ui.open_in_tab: true` in `manifest.json`)
- `src/background/index.ts` — service worker, bundled separately as an IIFE by a custom Vite plugin (MV3 workers can't use ES module chunks); also copies `manifest.json` into `dist/` and generates icon sizes from `public/icons/icon.png`

**Provider pattern** (`src/providers/`):
- `base.ts` — `SubscriptionInfo` (the data shape), `SubscriptionProvider` interface (`id`, `name`, `defaultToolId`, `permissions`, `fetch()`), and `createSubscriptionInfo()` for safe defaults
- Providers authenticate via `fetch(url, { credentials: "include" })`, relying on the browser's existing session cookies for that origin — they do **not** read cookies directly via `chrome.cookies`
- `index.ts` registers active providers in the `providers` array — new providers must be added here
- `_template.ts` is a copy-paste starting point for a new provider (compiled but not registered)
- Provider `fetch()` returns errors through `SubscriptionInfo.error` rather than throwing, so one failing provider never blocks the others

**Runtime permissions** (`src/permissions/`):
- Host access is requested at runtime via `chrome.permissions`, not granted statically — `manifest.json` lists these under `optional_host_permissions`, and each provider declares what it needs on its `permissions` field
- `createPermissionManager()` wraps `connect`/`disconnect`/`isConnected` per provider id, and on disconnect only removes a named permission if no other connected provider still needs it

**Tools catalog** (`src/tools/`):
- `catalog.ts` — built-in tool definitions; `custom.ts` — user-created tools (`createCustomTool`, URL normalization/suggestion)
- `index.ts` — merges built-in + custom tools, applies hidden/ordering state (`listTools`, `orderTools`, `findTool`)

**Launcher** (`src/launcher/`): `createLauncher()` opens a tool's tab and records the launch; used by the background worker's `open-tool` message handler.

**Preferences** (`src/preferences/`): theme (`light`/`dark`/`system`), locale, default popup view — persisted separately from `src/storage/`'s extension state.

**Storage** (`src/storage/`):
- Wraps `chrome.storage.local` under a single versioned `sublens_state` key (currently v3); `index.ts` migrates older/legacy shapes (pre-versioned `subscriptions`/`card_order` keys, v2 state) on load
- All mutations go through a serialized `mutate()` queue to avoid read-modify-write races
- Data is keyed by provider id (subscriptions) or tool id (favorites, recent, usage, custom tools, ordering)

**i18n** (`src/i18n/`): `locales/en.ts` and `locales/zh.ts`; `Locale` type is `"en" | "zh"`.

**Communication:** popup/options send messages like `{ type: "refresh" }`, `{ type: "refresh-provider", providerId }`, `{ type: "open-tool", toolId }`, `{ type: "set-favorite", toolId, favorite }`, `{ type: "open-provider-login", providerId }` to the background worker; it also runs a `sublens-refresh` alarm every 15 minutes and refreshes on install.

## Adding a New Provider

1. Copy `src/providers/_template.ts` to `src/providers/<id>.ts` and implement it against the real API.
2. Add the service's origin(s) to `optional_host_permissions` in `manifest.json`.
3. Register the exported provider in `src/providers/index.ts` (both the `export` line and the `providers` array).
4. Add a logo SVG to `public/logos/`.
5. Add a `permissions/index.ts`-style `ProviderAccessDefinition` entry if the provider needs a connect/disconnect UI flow in options.

## Key Conventions

- Provider fetch methods return a `SubscriptionInfo` with `error` populated on failure rather than throwing.
- Cookie-based auth is implicit via `credentials: "include"` — never pass cookie values manually or log them.
- Static assets (icons, logos) live in `public/` and are copied to `dist/` during build.
- `manifest.json` is copied to `dist/` by the custom Vite plugin in `vite.config.ts`, not by rollup's asset pipeline.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. Use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo. See `docs/agents/domain.md`.
